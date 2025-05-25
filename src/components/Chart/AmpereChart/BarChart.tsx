/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React from 'react';
import { Bar } from 'react-chartjs-2';
import { useSelector } from 'react-redux';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    ChartOptions,
    Legend,
    LinearScale,
    Title,
    Tooltip,
} from 'chart.js';

import { DataManager } from '../../../globals';
import {
    getWindowDuration,
    isTimestampsVisible,
    showSystemTime,
} from '../../../slices/chartSlice';
import { type CursorData } from '../Chart';
import { MultiAmpereState } from '../data/dataTypes';
import { timestampToLabel } from './LineChart';

interface BarChartProperties {
    barData: MultiAmpereState[];
    cursorData: CursorData;
}

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default ({
    barData,
    cursorData: { begin, end },
}: BarChartProperties) => {
    const windowDuration = useSelector(getWindowDuration);
    const timestampsVisible = useSelector(isTimestampsVisible);
    const systemTime = useSelector(showSystemTime);

    const options: ChartOptions<'bar'> = {
        animation: false,
        responsive: true,
        scales: {
            x: {
                type: 'linear',
                display: true,
                min: begin > 0 ? begin : 0,
                max: begin > 0 ? end : windowDuration,
                ticks: {
                    display: timestampsVisible,
                    autoSkipPadding: 25,
                    callback: value =>
                        timestampToLabel(
                            Number.parseInt(value.toString(), 10),
                            systemTime
                                ? DataManager().getStartSystemTime()
                                : undefined
                        ),
                    maxTicksLimit: 7,
                },
                border: {
                    display: true,
                },
                grid: {
                    drawOnChartArea: true,
                },
                afterFit: scale => {
                    scale.paddingRight = 32;
                },

                stacked: true,
            },
            y: {
                display: false,
                stacked: true,
            },
        },
    };
    const data = {
        labels: barData[0]?.data.map(t => t.x),
        datasets: barData.map(t => ({
            label: t.name,
            data: t.data,
            backgroundColor: t.color,
        })),
    };

    return (
        <div className="tw-relative tw-flex tw-min-h-[100px] tw-flex-grow">
            <Bar options={options} data={data} />
        </div>
    );
};
