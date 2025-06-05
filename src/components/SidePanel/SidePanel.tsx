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
    clearConfirmBeforeClose,
    Group,
    NumberInput,
    selectedDevice,
    selectedVirtualDevice,
    SidePanel,
    Spinner,
    StateSelector,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import {
    getCurrentChannel,
    switchCurrentDevice,
    updateAllGains,
    updateSpikeFilter,
} from '../../actions/deviceActions';
import DeprecatedDeviceDialog from '../../features/DeprecatedDevice/DeprecatedDevice';
import { triggerForceRerender as triggerForceRerenderMiniMap } from '../../features/minimap/minimapSlice';
import ProgressDialog from '../../features/ProgressDialog/ProgressDialog';
import { getShowProgressDialog } from '../../features/ProgressDialog/progressSlice';
import { DataManager } from '../../globals';
import {
    deviceOpen as deviceOpenSelector,
    isFileLoaded,
    isSavePending,
    updateCurrentDeviceAction,
} from '../../slices/appSlice';
import {
    isSessionActive,
    triggerForceRerender as triggerForceRerenderMainChart,
} from '../../slices/chartSlice';
import { resetGainsToDefaults } from '../../slices/gainsSlice';
import {
    getCurrentSelector,
    getDeviceSelectorList,
    getSampleOffset,
    setCurrentSelector,
    setSampleOffset,
} from '../../slices/multiDeviceSlice';
import { resetSpikeFilterToDefaults } from '../../slices/spikeFilterSlice';
import {
    resetVoltageRegulatorMaxCapPPK2,
    updateRegulator,
} from '../../slices/voltageRegulatorSlice';
import { getDevice, MultiDeviceItem } from '../../utils/multiDevice';
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
    const currentSelector = useSelector(getCurrentSelector);

    const sampleOffset = useSelector(getSampleOffset);

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

    const onDeviceItemClick = (
        selector: number,
        device: MultiDeviceItem,
        channel: number
    ) => {
        if (!device.device) {
            console.log('no device warning!');
            return;
        }

        const offset = DataManager().getSampleOffset(channel);
        dispatch(setSampleOffset(offset));

        dispatch(setCurrentSelector(selector));
        switchCurrentDevice(channel, device.device);

        dispatch(
            updateCurrentDeviceAction({
                capabilities: device.capabilities,
                portName: device.portName,
                isRunning: device.deviceRunning,
                isSmuMode: device.isSmuMode,
            })
        );
        dispatch(updateRegulator({ vdd: device.currentVdd }));

        dispatch(triggerForceRerenderMainChart());
        dispatch(triggerForceRerenderMiniMap());
    };

    const items = selectors.map((selName, sel) => {
        const deviceItem = getDevice(sel);

        if (!deviceItem) {
            return null;
        }

        const { device, channel } = deviceItem;

        return {
            key: selName,
            renderItem: (
                <span title={device?.portName ?? 'Unkown'}>CH{channel}</span>
            ),
        };
    });

    const unKnownItem = { key: '-1', renderItem: <span>Unkown</span> };

    const toggleSelector = (sel: number) => {
        const deviceItem = getDevice(sel);
        if (!deviceItem) {
            console.warn(`No device found for selector ${sel}`);
            return;
        }
        const { device, channel } = deviceItem;
        onDeviceItemClick(sel, device, channel);
    };

    return (
        <SidePanel className="side-panel tw-mt-9">
            {multiDevicePane &&
                items.filter(item => item !== null).length > 1 && (
                    <Group heading="Channel Selector" gap={4}>
                        <StateSelector
                            items={
                                items.filter(item => item !== null) as {
                                    key: string;
                                    renderItem: React.ReactNode;
                                }[]
                            }
                            onSelect={toggleSelector}
                            selectedItem={items[currentSelector] ?? unKnownItem}
                        />
                        <NumberInput
                            label="Set sample offset to"
                            value={sampleOffset}
                            unit="us"
                            range={{ min: 0, max: 1000000 }}
                            onChange={value => {
                                dispatch(setSampleOffset(value));
                            }}
                            onChangeComplete={value =>
                                DataManager().setSampleOffset(
                                    getCurrentChannel() ?? 0,
                                    value
                                )
                            }
                        />
                    </Group>
                )}
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
            <DeprecatedDeviceDialog />
            {showProgressDialog && <ProgressDialog />}
        </SidePanel>
    );
};
