/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    SidePanel,
    useHotKey,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import DeprecatedDeviceDialog from '../../features/DeprecatedDevice/DeprecatedDevice';
import MinimapOptions from '../../features/minimap/MinimapOptions';
import ProgressDialog from '../../features/ProgressDialog/ProgressDialog';
import { getShowProgressDialog } from '../../features/ProgressDialog/progressSlice';
import { updateTitle } from '../../globals';
import {
    advancedMode as advancedModeSelector,
    appState,
    deviceOpen as deviceOpenSelector,
    getFileLoaded,
    isFileLoaded,
    toggleAdvancedModeAction,
} from '../../slices/appSlice';
import { isSessionActive } from '../../slices/chartSlice';
import { resetTriggerOrigin } from '../../slices/triggerSlice';
import { isDataLoggerPane, isRealTimePane } from '../../utils/panes';
import { CapVoltageSettings } from './CapVoltageSettings';
import DisplayOptions from './DisplayOptions';
import Gains from './Gains';
import Instructions from './Instructions';
import { Load, Save } from './LoadSave';
import PowerMode from './PowerMode';
import SessionSettings from './SessionSettings';
import SpikeFilter from './SpikeFilter';
import StartStop from './StartStop';

import './sidepanel.scss';

const useAppTitle = () => {
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

export default () => {
    const dispatch = useDispatch();

    useAppTitle();
    const advancedMode = useSelector(advancedModeSelector);
    const deviceOpen = useSelector(deviceOpenSelector);
    const fileLoaded = useSelector(isFileLoaded);
    const sessionActive = useSelector(isSessionActive);
    const showProgressDialog = useSelector(getShowProgressDialog);
    const realTime = useSelector(isRealTimePane);
    const dataLogger = useSelector(isDataLoggerPane);

    useHotKey({
        hotKey: 'alt+ctrl+shift+a',
        title: 'Show advanced config',
        isGlobal: false,
        action: () => dispatch(toggleAdvancedModeAction()),
    });

    useEffect(() => {
        dispatch(resetTriggerOrigin());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [realTime]);

    return (
        <SidePanel className="side-panel tw-mt-9">
            {!deviceOpen && dataLogger && <Load />}
            {!fileLoaded && !deviceOpen && <Instructions />}
            {!fileLoaded && deviceOpen && (
                <>
                    <PowerMode />
                    <StartStop />
                </>
            )}
            {(fileLoaded || deviceOpen || sessionActive) && (
                <>
                    <DisplayOptions />
                    <Save />
                </>
            )}
            {!fileLoaded && deviceOpen && advancedMode && (
                <>
                    <SessionSettings />
                    <Gains />
                    <SpikeFilter />
                    <CapVoltageSettings />
                </>
            )}
            {!fileLoaded && !deviceOpen && advancedMode && <SessionSettings />}
            <DeprecatedDeviceDialog />
            {showProgressDialog && <ProgressDialog />}
        </SidePanel>
    );
};
