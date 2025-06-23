/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

const WebSocket = require('ws');

let ws = null;
let connectionUrl = null;

function clearScreen() {
    workerLog('INFO', '🧹 清屏');
    process.stdout.write('\x1b[2J');
}

function getTimestamp() {
    return new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    });
}

function workerLog(level, message, data) {
    const timestamp = getTimestamp();
    const prefix = `[${timestamp}] [WORKER-${level}]`;

    if (data !== undefined) {
        console.log(`${prefix} ${message}`, data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

process.on('message', msg => {
    if (msg.open) {
        clearScreen();
        connectionUrl = msg.open;
        workerLog('INFO', `🔌 准备连接到: ${connectionUrl}`);
        process.send({ opening: connectionUrl });

        // 关闭之前的连接（如果存在）
        if (ws) {
            workerLog('INFO', '🔄 关闭之前的连接...');
            ws.close();
            ws = null;
        }

        try {
            workerLog('INFO', '🚀 创建 WebSocket 连接...');
            ws = new WebSocket(connectionUrl);

            ws.onopen = () => {
                workerLog(
                    'INFO',
                    `✅ WebSocket连接已建立，状态: ${ws.readyState}`
                );
                process.send({ started: connectionUrl });
            };

            ws.onmessage = evt => {
                workerLog('INFO', `📥 收到服务器消息: ${evt.data}`);
                // 将接收到的数据发送给主进程
                try {
                    const data = Buffer.from(evt.data);
                    process.send({ data });
                } catch (error) {
                    workerLog(
                        'ERROR',
                        `❌ 处理接收数据时出错: ${error.message}`
                    );
                }
            };

            ws.onclose = evt => {
                workerLog(
                    'WARN',
                    `🔌 WebSocket连接已关闭 (代码: ${evt.code}, 原因: ${
                        evt.reason || '无'
                    }, 是否干净关闭: ${evt.wasClean})`
                );
                process.send({ state: 3 }); // WebSocket.CLOSED = 3
            };

            ws.onerror = error => {
                workerLog('ERROR', `❌ WebSocket错误:`, error);
                // 发送更详细的错误信息
                const errorMessage =
                    error.message ||
                    error.toString() ||
                    'Unknown WebSocket error';
                process.send({ error: errorMessage });
            };
        } catch (error) {
            workerLog('ERROR', `❌ 创建WebSocket连接失败: ${error.message}`);
            process.send({ error: error.toString() });
        }
    }
    if (msg.write && ws) {
        // 检查WebSocket状态并发送数据
        switch (ws.readyState) {
            case WebSocket.CONNECTING:
                workerLog('WARN', '⏳ WebSocket正在连接中，无法发送消息');
                break;
            case WebSocket.OPEN:
                try {
                    const dataToSend = JSON.stringify(msg.write);
                    ws.send(dataToSend);
                    workerLog('INFO', `📤 消息已发送到服务器`, msg.write);
                } catch (error) {
                    workerLog('ERROR', `❌ 发送消息失败: ${error.message}`);
                    process.send({ error: error.toString() });
                }
                break;
            case WebSocket.CLOSING:
                workerLog('WARN', '⏳ WebSocket正在关闭中，无法发送消息');
                break;
            case WebSocket.CLOSED:
                workerLog('WARN', '🔌 WebSocket已关闭，无法发送消息');
                break;
            default:
                workerLog('ERROR', `❓ WebSocket状态未知: ${ws.readyState}`);
                break;
        }

        // 发送当前状态给主进程
        process.send({ state: ws.readyState });
    }

    if (msg.close && ws) {
        workerLog('INFO', '🔄 正在关闭WebSocket连接...');
        ws.close();
    }
});

process.on('disconnect', () => {
    workerLog('WARN', '🔌 父进程已断开连接，正在清理资源...');
    if (ws) {
        ws.close();
        ws = null;
    }
    process.exit();
});
