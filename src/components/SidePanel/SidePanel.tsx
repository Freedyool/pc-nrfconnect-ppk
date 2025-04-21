/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    addConfirmBeforeClose,
    Button,
    classNames,
    clearConfirmBeforeClose,
    Group,
    selectedDevice,
    selectedVirtualDevice,
    SidePanel,
    Spinner,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import { updateAllGains, updateSpikeFilter } from '../../actions/deviceActions';
import DeprecatedDeviceDialog from '../../features/DeprecatedDevice/DeprecatedDevice';
import ProgressDialog from '../../features/ProgressDialog/ProgressDialog';
import { getShowProgressDialog } from '../../features/ProgressDialog/progressSlice';
import {
    deviceOpen as deviceOpenSelector,
    isFileLoaded,
    isSavePending,
} from '../../slices/appSlice';
import { isSessionActive } from '../../slices/chartSlice';
import { resetGainsToDefaults } from '../../slices/gainsSlice';
import {
    getDeviceSelectorList,
    getMultiDevices,
    getSelectedDeviceIndex,
    setSelectedDevice,
} from '../../slices/multiDeviceSlice';
import { resetSpikeFilterToDefaults } from '../../slices/spikeFilterSlice';
import { resetVoltageRegulatorMaxCapPPK2 } from '../../slices/voltageRegulatorSlice';
import {
    isDataLoggerPane,
    isMultiDevicePane,
    isScopePane,
} from '../../utils/panes';
import { CapVoltageSettings } from './CapVoltageSettings';
import DisplayOptions from './DisplayOptions';
import Gains from './Gains';
import Instructions from './Instructions';
import { Load, Save } from './LoadSave';
import PowerMode from './PowerMode';
import SessionSettings from './SessionSettings';
import SpikeFilter from './SpikeFilter';
import StartStop from './StartStop';

const useConfirmBeforeClose = () => {
    const pendingSave = useSelector(isSavePending);
    const dispatch = useDispatch();

    useEffect(() => {
        if (pendingSave) {
            dispatch(
                addConfirmBeforeClose({
                    id: 'unsavedData',
                    message:
                        'You have unsaved data. if you close the application this data will be lost. Are you sure you want to close?',
                })
            );
        } else {
            dispatch(clearConfirmBeforeClose('unsavedData'));
        }
    }, [dispatch, pendingSave]);
};

export default () => {
    const dispatch = useDispatch();
    const deviceIndex = useSelector(getSelectedDeviceIndex);
    const deviceConnected = useSelector(selectedDevice);
    const virtualDeviceConnected = useSelector(selectedVirtualDevice);
    const deviceOpen = useSelector(deviceOpenSelector);
    const fileLoaded = useSelector(isFileLoaded);
    const sessionActive = useSelector(isSessionActive);
    const showProgressDialog = useSelector(getShowProgressDialog);
    const scopePane = useSelector(isScopePane);
    const dataLoggerPane = useSelector(isDataLoggerPane);
    const multiDevicePane = useSelector(isMultiDevicePane);

    const selectors = useSelector(getDeviceSelectorList);
    const devices = useSelector(getMultiDevices);

    useConfirmBeforeClose();

    const connecting = deviceConnected && !deviceOpen;

    if (connecting) {
        return (
            <SidePanel className="side-panel tw-mt-9">
                <div className="tw-text-center tw-text-base">
                    <span>Connecting...</span> <Spinner size="sm" />
                </div>
            </SidePanel>
        );
    }

    const multiDeviceSelector = selectors.map((sel, i) => {
        const device = devices.find(d => d.selector === i);

        return (
            <button
                type="button"
                key={`d${i + 1}`}
                className={classNames(
                    'tw-h-6 tw-grow tw-border tw-border-solid tw-border-gray-700 tw-leading-none',
                    i === deviceIndex
                        ? 'tw-bg-white tw-text-gray-700'
                        : 'tw-bg-gray-700 tw-text-white'
                )}
                value={i}
                onClick={() => dispatch(setSelectedDevice(i))}
            >
                {device?.portName ?? sel}
            </button>
        );
    });

    return (
        <SidePanel className="side-panel tw-mt-9">
            {!deviceConnected && !virtualDeviceConnected && <Load />}
            {!fileLoaded &&
                !deviceConnected &&
                !virtualDeviceConnected &&
                !sessionActive && <Instructions />}
            {!fileLoaded &&
                deviceOpen &&
                (scopePane || dataLoggerPane || multiDevicePane) && (
                    <>
                        <PowerMode />
                        <StartStop />
                    </>
                )}
            {(fileLoaded || deviceOpen || sessionActive) &&
                (scopePane || dataLoggerPane || multiDevicePane) && (
                    <>
                        <Save />
                        <DisplayOptions />
                    </>
                )}
            {(dataLoggerPane || !deviceConnected) && <SessionSettings />}
            {!fileLoaded && deviceOpen && (dataLoggerPane || scopePane) && (
                <Group collapsible heading="Advanced Configuration" gap={8}>
                    <div className="tw-border tw-border-solid tw-border-gray-400 tw-p-2 tw-text-[10px] tw-text-gray-400">
                        WARNING Only change values if you know what you are
                        doing
                    </div>
                    <Gains />
                    <SpikeFilter />
                    <CapVoltageSettings />
                    <Button
                        onClick={() => {
                            dispatch(resetSpikeFilterToDefaults());
                            dispatch(updateSpikeFilter()); // send to device

                            dispatch(resetGainsToDefaults());
                            dispatch(updateAllGains()); // send to device

                            dispatch(resetVoltageRegulatorMaxCapPPK2());
                        }}
                        variant="secondary"
                    >
                        Reset to default Configuration
                    </Button>
                </Group>
            )}
            {multiDevicePane && devices.length > 1 && (
                <div className="tw-flex tw-flex-row tw-gap-0.5">
                    {multiDeviceSelector}
                </div>
            )}
            <DeprecatedDeviceDialog />
            {showProgressDialog && <ProgressDialog />}
        </SidePanel>
    );
};
