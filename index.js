'use strict';
const dgram = require('dgram');
const https = require('https');
const fs = require('fs');
const server = dgram.createSocket('udp4');
const PORT = 3001;

// API 키 로드
const API_KEY = fs.readFileSync('/root/kakaobot-dev/.env', 'utf8').trim();

function callClaude(question) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: '너는 하나의 게임 캐릭터야 친숙하고 20대 중반의 게임플레이어 처럼 대답해 요새 애들말투로',
            messages: [{ role: 'user', content: question }]
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.content[0].text);
                } catch (e) {
                    reject('응답 파싱 오류');
                }
            });
        });

        req.on('error', (e) => reject(e.message));
        req.write(body);
        req.end();
    });
}

server.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        const content = (data.msg || '').trim();

        function reply(text) {
            server.send(Buffer.from(text), rinfo.port, rinfo.address);
        }

        // !AI
        if (content.startsWith('!AI') || content.startsWith('!ai')) {
            const question = content.replace(/^!ai/i, '').trim();
            if (!question) return reply('❌ !AI [질문]\n예) !AI 소나타 2020년식 시세 얼마야?');
            callClaude(question)
                .then(answer => reply('🤖 ' + answer))
                .catch(err => reply('❌ AI 오류: ' + err));
            return;
        }

        // !이전비
        if (content.startsWith('!이전비')) {
            const input = content.replace('!이전비', '').trim();
            const parts = input.split('/');
            if (parts.length !== 2) return reply('❌ !이전비 [디비]/[성능비]\n예) !이전비 3000/153000');
            const db   = parseFloat(parts[0].replace(/,/g, '').trim());
            const perf = parseFloat(parts[1].replace(/,/g, '').trim());
            if (isNaN(db) || isNaN(perf)) return reply('❌ 숫자를 올바르게 입력해주세요.');
            const dbWon          = db * 10000;
            const carPrice       = Math.floor((dbWon - perf - 440000) / 1.07);
            const carPriceRounded = Math.floor(carPrice / 100000) * 100000;
            const acqTax         = Math.floor(carPriceRounded * 0.07);
            const all            = Math.floor(carPriceRounded + acqTax + perf + 440000);
            const dball          = Math.floor(dbWon - all);
            return reply(
                '💰 이전비 계산\n' +
                '─────────────────\n' +
                '디비: ' + dbWon.toLocaleString() + '원\n' +
                '성능비: ' + perf.toLocaleString() + '원\n' +
                '매도비: 440,000원\n' +
                '─────────────────\n' +
                '차량대금(원래): ' + carPrice.toLocaleString() + '원\n' +
                '차량대금(내림): ' + carPriceRounded.toLocaleString() + '원\n' +
                '취등록세(7%): ' + acqTax.toLocaleString() + '원\n' +
                '─────────────────\n' +
                '합계: ' + all.toLocaleString() + '원\n' +
                '남은금액: ' + dball.toLocaleString() + '원'
            );
        }

        if (content === '!입금계좌') return reply('🏦 입금계좌\n농협 서유성(드림자동차)\n352-2297-9362-13');
        if (content === '!메테오유') return reply('🏦 입금계좌\n농협 서유성(메테오유)\n301-0299-7392-51');
        if (content === '!상사주소') return reply('📍 상사주소\n경기도 부천시 원미구 신상로25, 275호\n(상동DY카랜드)');
        if (content === '!KB사업자') return reply('📋 KB사업자번호\n124-81-25121');
        if (content === '!법인서류') return reply('📋 KB 법인 조회 서류\n\n1. 법인사업자등록증\n2. 법인등기부등본\n3. 재무재표(24년,25년)\n4. 주주명부\n5. 부가가치세 과세표준증명원 (26년)');
        if (content === '!제주탁송') return reply('🚗 제주탁송 문의\n010-8265-2500');

        if (content === '!도움말') {
            return reply(
                '📋 [드림자동차 봇 명령어]\n' +
                '─────────────────────\n' +
                '💰 !이전비 [디비]/[성능비]\n' +
                '   예) !이전비 3000/150000\n' +
                '   기본 매도비 440,000원\n\n' +
                '🤖 !AI [질문]\n' +
                '   예) !AI 소나타 시세 얼마야?\n\n' +
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

