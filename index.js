'use strict';
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const PORT = 3001;

server.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        const content = (data.msg || '').trim();

        function reply(text) {
            server.send(Buffer.from(text), rinfo.port, rinfo.address);
        }

        // !이전비
        if (content.startsWith('!이전비')) {
            const input = content.replace('!이전비', '').trim();
            const parts = input.split('/');
            if (parts.length !== 2) return reply('❌ !이전비 [디비]/[성능비]\n예) !이전비 3000/153000');
            const db   = parseFloat(parts[0].replace(/,/g, '').trim());
            const perf = parseFloat(parts[1].replace(/,/g, '').trim());
            if (isNaN(db) || isNaN(perf)) return reply('❌ 숫자를 올바르게 입력해주세요.');

            const dbWon    = db * 10000;
            const carPrice = Math.floor((dbWon - perf - 440000) / 1.07);  // 차량대금
            const acqTax   = Math.floor(carPrice * 0.07);                  // 취등록세 7%
            const all      = Math.floor(carPrice + acqTax + perf + 440000); // 합계
            const dball    = Math.floor(dbWon - all);                       // 남은금액

            return reply(
                '💰 이전비 계산\n' +
                '─────────────────\n' +
                '디비: ' + dbWon.toLocaleString() + '원\n' +
                '성능비: ' + perf.toLocaleString() + '원\n' +
                '매도비: 440,000원\n' +
                '─────────────────\n' +
                '차량대금: ' + carPrice.toLocaleString() + '원\n' +
                '취등록세(7%): ' + acqTax.toLocaleString() + '원\n' +
                '─────────────────\n' +
                '합계: ' + all.toLocaleString() + '원\n' +
                '남은금액: ' + dball.toLocaleString() + '원'
            );
        }

        // !입금계좌
        if (content === '!입금계좌') {
            return reply('🏦 입금계좌\n농협 서유성(드림자동차)\n352-2297-9362-13');
        }

        // !메테오유
        if (content === '!메테오유') {
            return reply('🏦 입금계좌\n농협 서유성(메테오유)\n301-0299-7392-51');
        }

        // !상사주소
        if (content === '!상사주소') {
            return reply('📍 상사주소\n경기도 부천시 원미구 신상로25, 275호\n(상동DY카랜드)');
        }

        // !KB사업자
        if (content === '!KB사업자') {
            return reply('📋 KB사업자번호\n124-81-25121');
        }

        // !법인서류
        if (content === '!법인서류') {
            return reply('📋 KB 법인 조회 서류\n\n1. 법인사업자등록증\n2. 법인등기부등본\n3. 재무재표(24년,25년)\n4. 주주명부\n5. 부가가치세 과세표준증명원 (26년)');
        }

        // !제주탁송
        if (content === '!제주탁송') {
            return reply('🚗 제주탁송 문의\n010-8265-2500');
        }

        // !도움말
        if (content === '!도움말') {
            return reply(
                '📋 [드림자동차 봇 명령어]\n' +
                '─────────────────────\n' +
                '💰 !이전비 [디비]/[성능비]\n' +
                '   예) !이전비 3000/150000\n' +
                '   기본 매도비 440,000원\n\n' +
                '🏦 !입금계좌 — 드림자동차 계좌\n' +
                '🏦 !메테오유 — 메테오유 계좌\n' +
                '📍 !상사주소 — 상사 위치\n' +
                '📋 !KB사업자 — 사업자번호\n' +
                '📋 !법인서류 — KB 법인조회 서류목록\n' +
                '🚗 !제주탁송 — 탁송 문의번호\n' +
                '─────────────────────'
            );
        }

    } catch (e) {
        console.error('에러:', e.message);
    }
});

server.bind(PORT, () => {
    console.log('봇 가동 완료 (포트 ' + PORT + ')');
});
