import React, { type FC } from 'react';
import { useSearchItems } from '../api/useSearchItems';
import globalize from 'lib/globalize';
import Loading from 'components/loading/LoadingComponent';
import SearchDenseGrid from './SearchDenseGrid';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { Link } from 'react-router-dom';

interface SearchResultsProps {
    parentId?: string;
    collectionType?: CollectionType;
    query?: string;
    showPeople: boolean;
}

/*
 * React component to display search result rows for global search and library view search.
 * Uses a dense CSS grid layout with progressive rendering (infinite scroll).
 */
const SearchResults: FC<SearchResultsProps> = ({
    parentId,
    collectionType,
    query,
    showPeople
}) => {
    const { data, isPending } = useSearchItems(parentId, collectionType, query?.trim());

    if (isPending) return <Loading />;

    if (!data?.length) {
        return (
            <div className='noItemsMessage centerMessage'>
                {globalize.translate('SearchResultsEmpty', query)}
                {collectionType && (
                    <div>
                        <Link
                            className='emby-button'
                            to={`/search?query=${encodeURIComponent(query || '')}`}
                        >{globalize.translate('RetryWithGlobalSearch')}</Link>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className='padded-top padded-bottom-page'>
            <SearchDenseGrid
                sections={data}
                showPeople={showPeople}
            />
        </div>
    );
};

export default SearchResults;
