'use strict';
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const PORT = 3001;

server.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        const sender = data.sender || '';
        const content = (data.msg || '').trim();

        function reply(text) {
            const res = Buffer.from(text);
            server.send(res, rinfo.port, rinfo.address);
        }

        if (!content.startsWith('!이전비')) return;

        // !이전비 3000/153000 또는 !이전비 3000/153,000
        const input = content.replace('!이전비', '').trim();
        const parts = input.split('/');

        if (parts.length !== 2) {
            return reply('❌ !이전비 [디비]/[성능비]\n예) !이전비 3000/153000');
        }

        // 쉼표 제거 후 숫자 파싱
        const db  = parseFloat(parts[0].replace(/,/g, '').trim());
        const perf = parseFloat(parts[1].replace(/,/g, '').trim());

        if (isNaN(db) || isNaN(perf)) {
            return reply('❌ 숫자를 올바르게 입력해주세요.\n예) !이전비 3000/153000');
        }

        // 디비는 *10000 (3000 → 3천만)
        const dbWon  = db * 10000;
        const result = Math.floor((dbWon - perf - 440000) / 1.07);

        const formatted = result.toLocaleString('ko-KR');
        return reply(
            `💰 이전비 계산\n` +
            `디비: ${dbWon.toLocaleString()}원\n` +
            `성능비: ${perf.toLocaleString()}원\n` +
            `─────────────────\n` +
            `결과: ${formatted}원`
        );

    } catch (e) {
        console.error('에러:', e.message);
    }
});

server.bind(PORT, () => {
    console.log(`봇 가동 완료 (포트 ${PORT})`);
});
