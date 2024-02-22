/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Button,
    CollapsibleGroup,
    NumberInput,
} from '@nordicsemiconductor/pc-nrfconnect-shared';
import os from 'os';

import {
    getDiskFullTrigger,
    getSessionRootFolder,
    setDiskFullTrigger,
    setSessionRootFolder,
} from '../../slices/appSlice';
import { selectDirectoryDialog } from '../../utils/fileUtils';
import {
    setDiskFullTrigger as setPersistedDiskFullTrigger,
    setPreferredSessionLocation,
} from '../../utils/persistentStore';

export default () => {
    const dispatch = useDispatch();
    const sessionRootFolder = useSelector(getSessionRootFolder);
    const diskFullTrigger = useSelector(getDiskFullTrigger);

    return (
        <CollapsibleGroup heading="Session Data">
            <div className="tw-flex tw-flex-col tw-gap-4">
                <div className="tw-flex tw-flex-col tw-justify-between tw-gap-2">
                    <div className="tw-flex tw-flex-col tw-justify-between tw-gap-1">
                        <span>Root directory</span>
                        <div className="tw-inline-block tw-overflow-hidden tw-text-ellipsis">
                            <span
                                className="tw-whitespace-nowrap"
                                title={sessionRootFolder}
                            >
                                {sessionRootFolder}
                            </span>
                        </div>
                    </div>
                    <div className="tw-flex tw-gap-2">
                        <Button
                            className="tw-w-full"
                            variant="secondary"
                            onClick={() => {
                                selectDirectoryDialog().then(filePath => {
                                    dispatch(setSessionRootFolder(filePath));
                                    setPreferredSessionLocation(filePath);
                                });
                            }}
                        >
                            Change
                        </Button>
                        <Button
                            className="tw-w-full"
                            variant="secondary"
                            onClick={() => {
                                dispatch(setSessionRootFolder(os.tmpdir()));
                                setPreferredSessionLocation(os.tmpdir());
                            }}
                        >
                            Reset
                        </Button>
                    </div>
                </div>
                <NumberInput
                    label="Disk full trigger"
                    unit="MB"
                    value={diskFullTrigger}
                    range={{
                        min: 1,
                        max: 10240,
                        decimals: undefined,
                        step: undefined,
                    }}
                    onChange={(value: number) => {
                        dispatch(setDiskFullTrigger(value));
                        setPersistedDiskFullTrigger(value);
                    }}
                    showSlider
                />
            </div>
        </CollapsibleGroup>
    );
};
