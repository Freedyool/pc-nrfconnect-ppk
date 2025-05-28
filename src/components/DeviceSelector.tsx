/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Device,
    DeviceSelector,
    DeviceSetupConfig,
    getAppFile,
    isDeviceInDFUBootloader,
    logger,
    sdfuDeviceSetup,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import { close, open } from '../actions/deviceActions';
import { setShowPPK1Dialog } from '../features/DeprecatedDevice/DeprecatedDeviceSlice';
import {
    getDeviceSelectorList,
    setDeviceSelectorList,
} from '../slices/multiDeviceSlice';
import { isMultiDevicePane } from '../utils/panes';

const deviceListing = {
    nordicUsb: true,
    nordicDfu: true,
    serialPorts: true,
    jlink: true,
};

export const deviceSetupConfig: DeviceSetupConfig = {
    deviceSetups: [
        sdfuDeviceSetup(
            [
                {
                    key: 'ppk2',
                    application: getAppFile(
                        'firmware/pca63100_ppk2_1.2.0_97a781b.hex'
                    ),
                    semver: 'power_profiler_kit_2 1.2.0-97a781b',
                    params: {},
                },
            ],
            false,
            d =>
                !isDeviceInDFUBootloader(d) &&
                !!d.serialPorts &&
                d.serialPorts.length > 0 &&
                !!d.traits.nordicUsb &&
                !!d.usb &&
                d.usb.device.descriptor.idProduct === 0xc00a
        ),
    ],
};

export default () => {
    const dispatch = useDispatch();
    const selectorList = useSelector(getDeviceSelectorList);
    const multiDevicePanel = useSelector(isMultiDevicePane);

    useEffect(() => {
        if (multiDevicePanel) {
            dispatch(setDeviceSelectorList(['DEV1', 'DEV2', 'DEV3']));
        } else {
            dispatch(setDeviceSelectorList(['SELECT DEVICE']));
        }
    }, [dispatch, multiDevicePanel]);

    return (
        <DeviceSelector
            deviceSelectedList={selectorList}
            deviceSetupConfig={deviceSetupConfig}
            deviceListing={deviceListing}
            onDeviceConnected={device =>
                logger.info(`Device Connected SN:${device.serialNumber}`)
            }
            onDeviceDisconnected={device =>
                logger.info(`Device Disconnected SN:${device.serialNumber}`)
            }
            onDeviceSelected={(sel, device) => {
                if (device.traits.jlink) {
                    dispatch(setShowPPK1Dialog(true));
                }
                logger.info(
                    `${sel} Validating firmware for device with s/n ${device.serialNumber}`
                );
            }}
            onDeviceIsReady={(sel, device) => {
                logger.info(`Opening device with s/n ${device.serialNumber}`);
                dispatch(open(sel, device));
            }}
            onDeviceDeselected={sel => {
                logger.info('Deselecting device', sel);
                dispatch(close(sel));
            }}
            virtualDevices={['ADV-PPK1', 'ADV-PPK2', 'ADV-PPK3']}
            onVirtualDeviceSelected={(sel, device) => {
                logger.info(`${sel} ${device} selected`);
                const virtualDevice: Device = {
                    id: 0,
                    traits: {},
                    serialNumber: device,
                };
                dispatch(open(sel, virtualDevice));
            }}
            onVirtualDeviceDeselected={sel => {
                logger.info('Deselecting virtual device', sel);
                dispatch(close(sel));
            }}
        />
    );
};
