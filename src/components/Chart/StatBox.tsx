/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import { colors } from '@nordicsemiconductor/pc-nrfconnect-shared';

import { calcStats } from './data/dataAccumulator';
import SelectionStatBox from './SelectionStatBox';
import WindowStatBox from './WindowStatBox';

// 定义 Ref 类型
export type statAbortController = {
    abort: () => void;
};

interface StatBoxProperties {
    cursorBegin: number | null | undefined;
    cursorEnd: number | null | undefined;
    average?: number | null;
    max?: number | null;
    delta?: number | null;
    color?: string | null;
    channel?: number;
    rerenderTrigger: boolean;
    resetCursor: () => void;
    chartWindow: (
        windowBegin: number,
        windowEnd: number,
        yMin?: number | null,
        yMax?: number | null
    ) => void;
}

const StatBox = forwardRef<statAbortController, StatBoxProperties>(
    (
        {
            cursorBegin = null,
            cursorEnd = null,
            average = null,
            max = null,
            delta = null,
            color = null,
            channel = 0,
            rerenderTrigger = false,
            resetCursor,
            chartWindow,
        },
        ref
    ) => {
        const [selectionStats, setSelectionStats] = useState<{
            average: number;
            max: number;
            delta: number;
        } | null>(null);

        const [selectionStatsProcessing, setSelectionStatsProcessing] =
            useState(false);
        const [
            selectionStatsProcessingProgress,
            setSelectionStatsProcessingProgress,
        ] = useState(0);

        const selectionStateAbortController = useRef<AbortController>();

        useImperativeHandle(ref, () => ({
            abort: () => {
                if (selectionStateAbortController.current) {
                    selectionStateAbortController.current.abort();
                }
            },
        }));

        useEffect(() => {
            if (cursorBegin != null && cursorEnd != null) {
                selectionStateAbortController.current?.abort();
                setSelectionStatsProcessing(true);
                selectionStateAbortController.current = new AbortController();
                setSelectionStatsProcessingProgress(0);
                selectionStateAbortController.current.signal.addEventListener(
                    'abort',
                    () => setSelectionStatsProcessing(false)
                );
                const debounce = setTimeout(
                    () =>
                        calcStats(
                            (a, b, c) => {
                                setSelectionStats({
                                    average: a,
                                    max: b,
                                    delta: c,
                                });
                                setSelectionStatsProcessing(false);
                            },
                            cursorBegin,
                            cursorEnd,
                            selectionStateAbortController.current,
                            setSelectionStatsProcessingProgress,
                            channel
                        ),
                    300
                );
                return () => {
                    clearTimeout(debounce);
                };
            }

            setSelectionStats(null);
        }, [cursorBegin, cursorEnd, rerenderTrigger, channel]);

        return (
            <div className="tw-preflight tw-flex tw-w-80 tw-grow tw-flex-row tw-gap-1 tw-text-center">
                <div className="tw-flex tw-flex-grow tw-flex-wrap tw-gap-2">
                    <WindowStatBox
                        average={average ?? 0}
                        max={max ?? 0}
                        delta={delta ?? 0}
                        color={color ?? colors.nordicBlue}
                    />
                </div>
                <div className="tw-flex tw-flex-grow tw-flex-wrap tw-gap-2">
                    <SelectionStatBox
                        resetCursor={resetCursor}
                        progress={selectionStatsProcessingProgress}
                        processing={selectionStatsProcessing}
                        chartWindow={chartWindow}
                        {...selectionStats}
                    />
                </div>
            </div>
        );
    }
);

export default StatBox;
