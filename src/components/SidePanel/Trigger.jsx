/* Copyright (c) 2015 - 2018, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Use in source and binary forms, redistribution in binary form only, with
 * or without modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions in binary form, except as embedded into a Nordic
 *    Semiconductor ASA integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 2. Neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 3. This software, with or without modification, must only be used with a Nordic
 *    Semiconductor ASA integrated circuit.
 *
 * 4. Any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * THIS SOFTWARE IS PROVIDED BY NORDIC SEMICONDUCTOR ASA "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import React, { useState, useEffect } from 'react';
import { string } from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import Form from 'react-bootstrap/Form';

import { NumberInlineInput, Slider } from 'pc-nrfconnect-shared';

import Collapse from './Collapse';

import {
    triggerLengthUpdate,
    triggerStart,
    triggerStop,
    triggerSingleSet,
    externalTriggerToggled,
} from '../../actions/deviceActions';
import { appState } from '../../reducers/appReducer';
import { triggerState, triggerLevelSetAction } from '../../reducers/triggerReducer';
import { chartState, toggleTriggerHandle } from '../../reducers/chartReducer';

const SINGLE = 'SINGLE';
const CONTINUOUS = 'CONTINUOUS';
const EXTERNAL = 'EXTERNAL';

const Trigger = ({ eventKey }) => {
    const dispatch = useDispatch();
    const { rttRunning, capabilities } = useSelector(appState);
    const {
        externalTrigger,
        triggerRunning,
        triggerLevel,
    } = useSelector(triggerState);

    const { triggerHandleVisible } = useSelector(chartState);

    const range = {
        min: (450 * 13) / 1e3,
        max: (4000 * 13) / 1e3,
        decimals: 2,
    };

    const [level, setLevel] = useState(triggerLevel);
    // use true for mA, false for uA
    const [levelUnit, setLevelUnit] = useState(false);
    const [triggerLength, setTriggerLength] = useState(range.min);

    useEffect(() => {
        setLevelUnit(triggerLevel > 1000);
        setLevel(triggerLevel > 1000 ? Math.round(triggerLevel / 1000) : triggerLevel);
    }, [triggerLevel]);

    const sendTriggerLevel = unit => {
        dispatch(triggerLevelSetAction(level * (1000 ** unit)));
        setLevelUnit(unit);
    };

    const [triggerMode, setTriggerMode] = useState(CONTINUOUS);

    if (!capabilities.ppkTriggerSet) {
        return null;
    }

    let startLabel = 'External';
    let onStartClicked = null;
    if (!externalTrigger) {
        if (!triggerRunning) {
            startLabel = 'Start';
            if (triggerMode === SINGLE) {
                onStartClicked = () => dispatch(triggerSingleSet());
            } else {
                onStartClicked = () => dispatch(triggerStart());
            }
        } else {
            onStartClicked = () => dispatch(triggerStop());
            if (triggerMode === SINGLE) {
                startLabel = 'Wait';
            } else {
                startLabel = 'Stop';
            }
        }
    }

    const onTriggerToggled = enable => {
        if (triggerHandleVisible !== enable) {
            dispatch(toggleTriggerHandle());
        }
    };

    return (
        <Collapse
            title="TRIGGER"
            eventKey={eventKey}
            className="trigger-collapse"
            onToggled={onTriggerToggled}
        >
            <ButtonGroup className="mb-2 trigger-mode d-flex flex-row">
                <Button
                    disabled={!rttRunning || triggerMode === SINGLE}
                    variant={triggerMode === SINGLE ? 'set' : 'unset'}
                    onClick={() => {
                        setTriggerMode(SINGLE);
                        if (externalTrigger) {
                            dispatch(externalTriggerToggled(false));
                        }
                    }}
                >
                    Single
                </Button>
                <Button
                    disabled={!rttRunning || triggerMode === CONTINUOUS}
                    variant={triggerMode === CONTINUOUS ? 'set' : 'unset'}
                    onClick={() => {
                        setTriggerMode(CONTINUOUS);
                        if (externalTrigger) {
                            dispatch(externalTriggerToggled(false));
                        }
                    }}
                >
                    Continuous
                </Button>
                <Button
                    disabled={!rttRunning || triggerMode === EXTERNAL}
                    variant={triggerMode === EXTERNAL ? 'set' : 'unset'}
                    onClick={() => {
                        setTriggerMode(EXTERNAL);
                        dispatch(externalTriggerToggled(true));
                    }}
                >
                    External
                </Button>
            </ButtonGroup>
            <Button
                className="w-100 mb-2"
                disabled={!rttRunning || externalTrigger}
                variant="set"
                onClick={onStartClicked}
            >
                {startLabel}
            </Button>
            <Form.Label htmlFor="slider-trigger-window">
                <span className="flex-fill">Length</span>
                <NumberInlineInput
                    value={triggerLength}
                    range={range}
                    onChange={value => setTriggerLength(value)}
                    onChangeComplete={() => dispatch(triggerLengthUpdate(triggerLength))}
                    chars={6}
                />
                {' '}ms
            </Form.Label>
            <Slider
                id="slider-trigger-window"
                values={[triggerLength]}
                range={range}
                onChange={[value => setTriggerLength(value)]}
                onChangeComplete={() => dispatch(triggerLengthUpdate(triggerLength))}
            />
            <div className={externalTrigger ? 'disabled' : ''}>
                <Form.Label
                    htmlFor="slider-trigger-level"
                    className="d-flex flex-row align-items-baseline"
                >
                    <span className="flex-fill">Level</span>
                    <NumberInlineInput
                        value={level}
                        range={{ min: 1, max: 1000 }}
                        onChange={value => setLevel(parseInt(value, 10))}
                        onChangeComplete={() => sendTriggerLevel(levelUnit)}
                    />
                    <Dropdown>
                        <Dropdown.Toggle id="dropdown-current-unit" variant="plain">
                            {levelUnit ? 'mA' : '\u00B5A'}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item
                                eventKey="0"
                                onSelect={() => sendTriggerLevel(false)}
                            >
                                {'\u00B5A'}
                            </Dropdown.Item>
                            <Dropdown.Item
                                eventKey="0"
                                onSelect={() => sendTriggerLevel(true)}
                            >
                                mA
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Form.Label>
                <Slider
                    id="slider-trigger-level"
                    values={[level]}
                    range={{ min: 1, max: 1000 }}
                    onChange={[value => setLevel(parseInt(value, 10))]}
                    onChangeComplete={() => sendTriggerLevel(levelUnit)}
                />
            </div>
        </Collapse>
    );
};

Trigger.propTypes = {
    eventKey: string.isRequired,
};

export default Trigger;
