import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import React, { type FC, useEffect, useRef, useState, useCallback } from 'react';
import globalize from 'lib/globalize';
import Cards from 'components/cardbuilder/Card/Cards';
import type { CardOptions } from 'types/cardOptions';
import { CardShape } from 'utils/card';
import type { Section } from '../types';
import './searchgrid.scss';

// People/artist section titles to separate from media
const PEOPLE_SECTION_TITLES = new Set(['People', 'Artists']);

// How many items to render per "page" for progressive rendering
const RENDER_PAGE_SIZE = 50;

interface SearchDenseGridProps {
    sections: Section[];
    showPeople: boolean;
}

const MEDIA_CARD_OPTIONS: CardOptions = {
    shape: CardShape.Auto,
    scalable: false,
    showTitle: true,
    overlayText: false,
    centerText: true,
    allowBottomPadding: false
};

const PEOPLE_CARD_OPTIONS: CardOptions = {
    shape: CardShape.Portrait,
    scalable: false,
    showTitle: true,
    coverImage: true,
    overlayText: false,
    centerText: true,
    allowBottomPadding: false
};

function buildFlatItems(sections: Section[], showPeople: boolean): Array<{ item: BaseItemDto; title: string; sectionTitle: string; cardOptions: CardOptions }> {
    const result: Array<{ item: BaseItemDto; title: string; sectionTitle: string; cardOptions: CardOptions }> = [];

    for (const section of sections) {
        const isPeopleSection = PEOPLE_SECTION_TITLES.has(section.title);
        if (isPeopleSection && !showPeople) continue;

        const cardOptions = isPeopleSection ? PEOPLE_CARD_OPTIONS : { ...MEDIA_CARD_OPTIONS, ...section.cardOptions };

        for (const item of section.items) {
            result.push({
                item,
                title: item.Name ?? '',
                sectionTitle: section.title,
                cardOptions
            });
        }
    }

    return result;
}

const SearchDenseGrid: FC<SearchDenseGridProps> = ({ sections, showPeople }) => {
    const [renderCount, setRenderCount] = useState(RENDER_PAGE_SIZE);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Group sections for rendering with headers
    const mediaSections = sections.filter(s => !PEOPLE_SECTION_TITLES.has(s.title));
    const peopleSections = sections.filter(s => PEOPLE_SECTION_TITLES.has(s.title));
    const visibleSections = showPeople ? [...mediaSections, ...peopleSections] : mediaSections;

    // Flatten all visible items for progressive rendering count
    const flatItems = buildFlatItems(sections, showPeople);
    const totalItems = flatItems.length;

    // Reset render count when sections change
    useEffect(() => {
        setRenderCount(RENDER_PAGE_SIZE);
    }, [sections, showPeople]);

    const loadMore = useCallback(() => {
        setRenderCount(prev => Math.min(prev + RENDER_PAGE_SIZE, totalItems));
    }, [totalItems]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && renderCount < totalItems) {
                    loadMore();
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadMore, renderCount, totalItems]);

    // Render sections with progressive item count
    let itemsRendered = 0;

    return (
        <div className='searchDenseGrid'>
            {visibleSections.map(section => {
                if (itemsRendered >= renderCount) return null;

                const isPeopleSection = PEOPLE_SECTION_TITLES.has(section.title);
                const cardOptions = isPeopleSection
                    ? PEOPLE_CARD_OPTIONS
                    : { ...MEDIA_CARD_OPTIONS, ...section.cardOptions };

                const remainingSlots = renderCount - itemsRendered;
                const visibleItems = section.items.slice(0, remainingSlots);
                itemsRendered += visibleItems.length;

                if (visibleItems.length === 0) return null;

                return (
                    <React.Fragment key={section.title}>
                        <div className='searchDenseGrid-section'>
                            {globalize.translate(section.title)}
                        </div>
                        <Cards
                            items={visibleItems as Parameters<typeof Cards>[0]['items']}
                            cardOptions={cardOptions}
                        />
                    </React.Fragment>
                );
            })}

            {renderCount < totalItems && (
                <div ref={sentinelRef} className='searchDenseGrid-sentinel'>
                    {globalize.translate('Loading')}
                </div>
            )}
        </div>
    );
};

export default SearchDenseGrid;
