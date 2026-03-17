import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from 'hooks/useApi';
import type { ItemDto } from 'types/base/models/item-dto';

const CYCLE_INTERVAL_MS = 900;

/**
 * Returns a cycling image URL for items that have chapter images.
 * On hover start: begins cycling through chapter images at CYCLE_INTERVAL_MS.
 * Falls back to the provided staticUrl if no chapters are available.
 */
export function useChapterImageCycling(item: ItemDto, staticUrl: string | undefined) {
    const { api } = useApi();
    const [activeUrl, setActiveUrl] = useState<string | undefined>(staticUrl);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const indexRef = useRef(0);
    const chapterUrlsRef = useRef<string[]>([]);

    // Build chapter URLs from item data (Chapters field must be requested)
    useEffect(() => {
        const chapters = (item as { Chapters?: Array<{ ImageTag?: string | null }> }).Chapters;
        if (!api || !item.Id || !chapters?.length) {
            chapterUrlsRef.current = [];
            return;
        }

        const urls: string[] = chapters
            .filter(ch => ch.ImageTag)
            .map((ch, index) =>
                getImageApi(api).getItemImageUrlById(item.Id!, ImageType.Chapter, {
                    imageIndex: index,
                    tag: ch.ImageTag!,
                    quality: 85,
                    fillWidth: 320
                })
            );

        chapterUrlsRef.current = urls;
    }, [api, item]);

    const startCycling = useCallback(() => {
        if (chapterUrlsRef.current.length < 2) return;

        indexRef.current = 0;
        setActiveUrl(chapterUrlsRef.current[0]);

        intervalRef.current = setInterval(() => {
            indexRef.current = (indexRef.current + 1) % chapterUrlsRef.current.length;
            setActiveUrl(chapterUrlsRef.current[indexRef.current]);
        }, CYCLE_INTERVAL_MS);
    }, []);

    const stopCycling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setActiveUrl(staticUrl);
    }, [staticUrl]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Keep activeUrl in sync when staticUrl changes (e.g. component reuse)
    useEffect(() => {
        if (!intervalRef.current) {
            setActiveUrl(staticUrl);
        }
    }, [staticUrl]);

    const hasChapters = chapterUrlsRef.current.length >= 2;

    return { activeUrl, startCycling, stopCycling, hasChapters };
}
