/*
 * Copyright (c) 2025 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

// 用于替代 ppk2 硬件向上层注入采样数据的虚拟设备

const dataMock = () => Buffer.alloc(0);

process.on('message', msg => {
    console.log('message recved:', msg);
    if (msg.open) {
        console.log('\x1b[2J'); // ansi clear screen
        process.send({ opening: msg.open });

        setInterval(() => {
            const data = dataMock();
            process.send(data.slice(), err => {
                if (err) console.log(err);
            });
        }, 3000);

        process.send({ started: msg.open });
    }
    if (msg.write) {
        // TODO
    }
});

process.on('disconnect', () => {
    console.log('parent process disconnected, cleaning up');
    process.exit();
});
