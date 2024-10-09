/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Group,
    NumberInput,
    Toggle,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import { isTimestampsVisible, toggleTimestamps } from '../../slices/chartSlice';

export default () => {
    const dispatch = useDispatch();
    const timestampsVisible = useSelector(isTimestampsVisible);

    return (
        <Group
            heading="Simulate options"
            collapsible
            defaultCollapsed={false}
            gap={4}
        >
            <Toggle
                onToggle={() => dispatch(toggleTimestamps())}
                isToggled={timestampsVisible}
                label="Timestamps"
                variant="primary"
            />

            {/* <Toggle
                onToggle={() => dispatch(toggleDigitalChannels())}
                isToggled={digitalChannelsVisible}
                label="Digital channels"
                variant="primary"
            />

            <Toggle
                label="Show Minimap"
                title={`Click in order to ${showMinimap ? 'hide' : 'show'
                    } a navigable minimap`}
                onToggle={() =>
                    // dispatch(setShowMinimapAction(!showMinimap))
                    console.log('Show Minimap')
                }
                isToggled={showMinimap}
            >
                Show Minimap
            </Toggle>

            <NumberInput
                title="Supply voltage to the device will be capped to this value"
                label="Set max supply voltage to"
                value={newMaxCap}
                range={{ min, max }}
                onChange={value => setNewMaxCap(value)}
                onChangeComplete={() => {
                    updateVoltageRegulator();
                    telemetry.sendEvent(EventAction.VOLTAGE_MAX_LIMIT_CHANGED, {
                        maxCap: newMaxCap,
                    });
                }}
                showSlider
                unit="mV"
            /> */}
        </Group>
    );
};
