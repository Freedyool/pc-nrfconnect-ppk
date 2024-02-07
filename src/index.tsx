/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    App,
    render,
    selectedDevice,
    telemetry,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import Chart from './components/Chart/Chart';
import DeviceSelector from './components/DeviceSelector';
import SidePanel from './components/SidePanel/SidePanel';
import { updateTitle } from './globals';
import reducers from './slices';
import { getFileLoaded, isSavePending } from './slices/appSlice';
import { getRecordingMode } from './slices/chartSlice';
import { isDataLoggerPane, isRealTimePane } from './utils/panes';

import './index.scss';

telemetry.enableTelemetry();

const AppTitleHook = () => {
    const device = useSelector(selectedDevice);
    const fileName = useSelector(getFileLoaded);
    const pendingSave = useSelector(isSavePending);

    useEffect(() => {
        if (fileName) {
            updateTitle(fileName);
            return;
        }

        let title = '';
        if (device?.serialNumber) {
            title += device.serialNumber;
        }

        if (pendingSave) {
            title += ' - Unsaved data*';
        }

        updateTitle(title);
    });

    return null;
};

const ChartWrapper: React.FC<{ active: boolean }> = ({ active }) => {
    const currentMode = useSelector(getRecordingMode);
    const dataLoggerPane = useSelector(isDataLoggerPane);
    const realTimePane = useSelector(isRealTimePane);
    const paneName = currentMode === 'DataLogger' ? 'Data Logger' : 'Real Time';

    if (
        (currentMode === 'DataLogger' && !dataLoggerPane) ||
        (currentMode === 'RealTime' && !realTimePane)
    )
        return (
            <div className="tw-flex tw-h-full tw-items-center tw-justify-center">
                <div>
                    Currently the device is running in {paneName} mode. Switch
                    to the <span className="tw-uppercase">{paneName}</span> tab
                    to see the results.
                </div>
            </div>
        );

    return active ? <Chart /> : null;
};

render(
    <App
        appReducer={reducers}
        deviceSelect={<DeviceSelector />}
        sidePanel={<SidePanel />}
        feedback
        panes={[
            { name: 'Data Logger', Main: ChartWrapper },
            { name: 'Real Time', Main: ChartWrapper },
        ]}
    >
        <AppTitleHook />
    </App>
);
