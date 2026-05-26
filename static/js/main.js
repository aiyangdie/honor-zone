const PLATFORM_NAMES_FALLBACK = {
    aqq: '安卓 QQ',
    awx: '安卓微信',
    iqq: '苹果 QQ',
    iwx: '苹果微信',
};

let platformNames = { ...PLATFORM_NAMES_FALLBACK };

let zonesCache = [];
let currentZoneId = null;
let currentZoneName = '';

const DEFAULT_AVATAR = 'https://game.gtimg.cn/images/yxzj/img201606/heroimg/166/166.jpg';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadPlatforms();
    loadHeroList();
    checkService();
    loadZones();
    
    document.getElementById('hero-query-form').addEventListener('submit', querySingle);
    document.getElementById('query-all-btn').addEventListener('click', queryAllPlatforms);

    document.querySelectorAll('.chip[data-hero]').forEach(chip => {
        chip.addEventListener('click', () => {
            switchTab('power');
            document.getElementById('hero-name').value = chip.dataset.hero;
            document.getElementById('hero-query-form').requestSubmit();
        });
    });

    document.getElementById('zone-select').addEventListener('change', onZoneChange);
    document.getElementById('refresh-leaderboard').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.add('is-spinning');
        btn.addEventListener('animationend', () => btn.classList.remove('is-spinning'), { once: true });
        if (currentZoneId) loadLeaderboard(currentZoneId);
        else toast('请先选择战区', true);
    });

    document.getElementById('create-user-form').addEventListener('submit', createUser);
    document.getElementById('update-score-form').addEventListener('submit', updateScore);
    
    document.getElementById('create-zone-btn').addEventListener('click', createZone);
    document.getElementById('new-zone-name').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); createZone(); }
    });
    document.getElementById('seed-demo-btn').addEventListener('click', seedDemoData);
    document.getElementById('lookup-user-btn').addEventListener('click', lookupUser);
    document.getElementById('lookup-user-id').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); lookupUser(); }
    });

    document.getElementById('help-btn').addEventListener('click', openHelp);
    document.getElementById('close-help').addEventListener('click', closeHelp);
    document.getElementById('drawer-backdrop').addEventListener('click', closeHelp);

    initAllCustomSelects();
});

/* ---------- Tabs ---------- */
function initTabs() {
    document.querySelectorAll('.app-tabs__btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(name) {
    document.querySelectorAll('.app-tabs__btn').forEach(btn => {
        const active = btn.dataset.tab === name;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        const show = panel.id === `tab-${name}`;
        panel.classList.toggle('is-active', show);
        panel.classList.toggle('hidden', !show);
    });
}

/* ---------- Platforms ---------- */
const FALLBACK_PLATFORMS = [
    { id: 'aqq', name: '安卓 QQ' },
    { id: 'awx', name: '安卓微信' },
    { id: 'iqq', name: '苹果 QQ' },
    { id: 'iwx', name: '苹果微信' },
];

async function loadPlatforms() {
    const grid = document.getElementById('platform-grid');
    let platforms = FALLBACK_PLATFORMS;
    try {
        const res = await fetch('/api/platforms');
        const data = await res.json();
        if (data.status === 'success' && data.data.platforms?.length) {
            platforms = data.data.platforms;
        }
    } catch { /* use fallback */ }

    platformNames = {};
    platforms.forEach(p => {
        platformNames[p.id] = resolvePlatformLabel(p);
    });

    grid.innerHTML = platforms.map((p, i) => `
        <label class="segmented__item">
            <input type="radio" name="platform" value="${escAttr(p.id)}" ${i === 0 ? 'checked' : ''}>
            <span>${esc(resolvePlatformLabel(p))}</span>
        </label>
    `).join('');
}

function resolvePlatformLabel(p) {
    if (typeof p.name === 'string') return p.name;
    if (p.name && typeof p.name.name === 'string') return p.name.name;
    return PLATFORM_NAMES_FALLBACK[p.id] || p.id;
}

/* ---------- Zones & Leaderboard ---------- */
async function loadZones() {
    const zoneSelect = document.getElementById('zone-select');
    const userZone = document.getElementById('user-zone');

    try {
        const res = await fetch('/api/zones');
        const data = await res.json();
        if (data.status !== 'success') {
            toast('加载战区失败', true);
            return;
        }
        zonesCache = (data.data.zones || []).filter(z => isValidZoneName(z.name));
        populateZoneSelects(zonesCache);
    } catch {
        toast('加载战区出错，请检查服务', true);
        zoneSelect.innerHTML = '<option value="">加载失败</option>';
        userZone.innerHTML = '<option value="">加载失败</option>';
        refreshCustomSelect(zoneSelect);
        refreshCustomSelect(userZone);
    }
}

function populateZoneSelects(zones) {
    const zoneSelect = document.getElementById('zone-select');
    const userZone = document.getElementById('user-zone');

    const opts = zones.length
        ? zones.map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('')
        : '<option value="">暂无战区</option>';

    zoneSelect.innerHTML = `<option value="">请选择战区</option>${opts}`;
    userZone.innerHTML = `<option value="">请选择战区</option>${opts}`;

    if (zones.length > 0) {
        currentZoneId = String(zones[0].id);
        currentZoneName = zones[0].name;
        zoneSelect.value = currentZoneId;
        document.getElementById('zone-name-label').textContent = currentZoneName;
        loadLeaderboard(currentZoneId);
    } else {
        document.getElementById('zone-name-label').textContent = '暂无可用战区';
    }

    refreshCustomSelect(zoneSelect);
    refreshCustomSelect(userZone);
}

function isValidZoneName(name) {
    if (!name || typeof name !== 'string') return false;
    const t = name.trim();
    if (!t || /^[\s?？]+$/.test(t)) return false;
    if (t === '????' || t === '???') return false;
    return true;
}

function onZoneChange() {
    const sel = document.getElementById('zone-select');
    currentZoneId = sel.value;
    if (!currentZoneId) {
        document.getElementById('zone-name-label').textContent = '请选择战区';
        document.getElementById('leaderboard-body').innerHTML =
            '<tr><td colspan="4" class="rank-table__empty">请选择战区查看排行</td></tr>';
        return;
    }
    currentZoneName = sel.options[sel.selectedIndex].text;
    document.getElementById('zone-name-label').textContent = currentZoneName;
    loadLeaderboard(currentZoneId);
}

async function loadLeaderboard(zoneId) {
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = '<tr><td colspan="4" class="rank-table__loading"><span class="spinner-inline"></span> 加载中…</td></tr>';

    try {
        const res = await fetch(`/api/leaderboard/zone/${zoneId}?start=0&end=19`);
        const data = await res.json();
        if (data.status !== 'success') {
            body.innerHTML = `<tr><td colspan="4" class="rank-table__empty">${esc(data.message || '加载失败')}</td></tr>`;
            return;
        }
        if (data.data.zone_name) {
            currentZoneName = data.data.zone_name;
            document.getElementById('zone-name-label').textContent = currentZoneName;
        }
        displayLeaderboard(data.data.leaderboard || []);
    } catch {
        body.innerHTML = '<tr><td colspan="4" class="rank-table__empty">网络异常，请稍后重试</td></tr>';
    }
}

function displayLeaderboard(rows) {
    const body = document.getElementById('leaderboard-body');
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="4" class="rank-table__empty">该战区暂无排行数据，可在用户中心创建用户</td></tr>';
        return;
    }
    
    body.innerHTML = rows.map(row => {
        const rankClass = row.rank <= 3 ? ` rank-table__rank--top${row.rank}` : '';
        const nick = row.nickname || '未知玩家';
        const avatarSrc = row.avatar_url || DEFAULT_AVATAR;
        const avatar = `<img class="rank-avatar" src="${escAttr(avatarSrc)}" alt="${esc(nick)}的头像" loading="lazy"
            onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">`;
        return `
            <tr>
                <td data-label="排名"><span class="rank-table__rank${rankClass}">${row.rank}</span></td>
                <td data-label="头像">${avatar}</td>
                <td data-label="昵称" class="rank-table__name" title="${escAttr(nick)}">${esc(nick)}</td>
                <td data-label="积分" class="rank-table__score">${formatScore(row.score)}</td>
            </tr>
        `;
    }).join('');
}

function formatScore(score) {
    const n = Number(score);
    if (Number.isNaN(n)) return '0';
    return n.toLocaleString('zh-CN');
}

async function createZone() {
    const input = document.getElementById('new-zone-name');
    const name = input.value.trim();
    if (!name) return toast('请输入战区名称', true);

    try {
        const res = await fetch('/api/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, level: 1 }),
        });
        const data = await res.json();
        if (data.status !== 'success') {
            toast(data.message || '创建失败', true);
            return;
        }
        toast(`战区「${data.data.name}」已创建`);
        input.value = '';
        await loadZones();
        if (data.data.id) {
            document.getElementById('zone-select').value = String(data.data.id);
            currentZoneId = String(data.data.id);
            currentZoneName = data.data.name;
            document.getElementById('zone-name-label').textContent = currentZoneName;
            loadLeaderboard(currentZoneId);
        }
    } catch {
        toast('网络异常，请稍后重试', true);
    }
}

async function seedDemoData() {
    if (!confirm('将导入演示战区与用户（不删除已有数据），是否继续？')) return;

    const btn = document.getElementById('seed-demo-btn');
    btn.disabled = true;
    try {
        const res = await fetch('/api/seed', { method: 'POST' });
        const data = await res.json();
        if (data.status !== 'success') {
            toast(data.message || '导入失败', true);
            return;
        }
        const c = data.data || {};
        toast(`已导入：战区 ${c.zones || 0} 个，用户 ${c.users || 0} 个`);
        await loadZones();
        if (currentZoneId) loadLeaderboard(currentZoneId);
    } catch {
        toast('网络异常，请稍后重试', true);
    } finally {
        btn.disabled = false;
    }
}

/* ---------- User ---------- */
async function createUser(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim();
    const avatar_url = document.getElementById('avatar-url').value.trim();
    const zoneId = document.getElementById('user-zone').value;
    
    if (!nickname) return toast('请输入昵称', true);
    if (!zoneId) return toast('请选择战区', true);

    const initialScore = parseInt(document.getElementById('initial-score')?.value, 10);
    const payload = {
        nickname,
        current_zone_id: parseInt(zoneId, 10),
        total_score: Number.isNaN(initialScore) ? 1000 : Math.max(0, initialScore),
    };
    if (avatar_url) payload.avatar_url = avatar_url;

    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.status !== 'success') {
            toast(data.message || '创建失败', true);
            return;
        }
        toast(`用户创建成功，ID：${data.data.id}`);
        document.getElementById('user-id').value = data.data.id;
        document.getElementById('create-user-form').reset();
        document.getElementById('user-zone').value = zoneId;
        if (String(currentZoneId) === zoneId) loadLeaderboard(zoneId);
    } catch {
        toast('网络异常，请稍后重试', true);
    }
}

async function updateScore(e) {
    e.preventDefault();
    const user_id = parseInt(document.getElementById('user-id').value, 10);
    const score = parseInt(document.getElementById('score-delta').value, 10);

    if (!user_id || Number.isNaN(user_id)) return toast('请输入有效用户 ID', true);
    if (Number.isNaN(score)) return toast('请输入有效积分', true);

    try {
        const res = await fetch('/api/scores/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id, score }),
        });
        const data = await res.json();
        if (data.status !== 'success') {
            toast(data.message || '更新失败', true);
            return;
        }
        toast(`积分已更新，当前总分：${data.data.new_score}`);
        document.getElementById('score-delta').value = '';
        if (currentZoneId) loadLeaderboard(currentZoneId);
    } catch {
        toast('网络异常，请稍后重试', true);
    }
}

async function lookupUser() {
    const userId = parseInt(document.getElementById('lookup-user-id').value, 10);
    const card = document.getElementById('user-profile-card');
    if (!userId || Number.isNaN(userId)) {
        toast('请输入有效用户 ID', true);
        return;
    }
    
    card.classList.remove('hidden');
    card.innerHTML = '<p class="profile-card__loading"><span class="spinner-inline"></span> 查询中…</p>';

    try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (data.status !== 'success') {
            card.innerHTML = `<p class="profile-card__empty">${esc(data.message || '未找到用户')}</p>`;
            return;
        }
        const u = data.data;
        const avatarSrc = u.avatar_url || DEFAULT_AVATAR;
        const winPct = u.win_rate != null ? `${Math.round(Number(u.win_rate) * 100)}%` : '—';
        card.innerHTML = `
            <div class="profile-card__head">
                <img class="profile-card__avatar" src="${escAttr(avatarSrc)}" alt=""
                     onerror="this.src='${DEFAULT_AVATAR}'">
                <div>
                    <h4 class="profile-card__name">${esc(u.nickname)}</h4>
                    <p class="profile-card__id">ID ${u.id}</p>
                </div>
            </div>
            <ul class="profile-card__meta">
                <li><span>所属战区</span><b>${esc(u.zone_name || '未分配')}</b></li>
                <li><span>总积分</span><b class="profile-card__score">${formatScore(u.total_score)}</b></li>
                <li><span>英雄等级</span><b>${u.hero_level ?? '—'} <em class="profile-card__demo">演示</em></b></li>
                <li><span>胜率</span><b>${winPct} <em class="profile-card__demo">演示</em></b></li>
                <li><span>注册时间</span><b>${esc(formatDate(u.created_at))}</b></li>
            </ul>
        `;
        document.getElementById('user-id').value = u.id;
    } catch {
        card.innerHTML = '<p class="profile-card__empty">网络异常，请稍后重试</p>';
    }
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString('zh-CN', { hour12: false });
    } catch {
        return iso;
    }
}

/* ---------- Hero power ---------- */
function getPlatform() {
    const checked = document.querySelector('input[name="platform"]:checked');
    return checked ? checked.value : 'aqq';
}

function openHelp() {
    const el = document.getElementById('help-drawer');
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeHelp() {
    const el = document.getElementById('help-drawer');
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function loadHeroList() {
    try {
        const res = await fetch('/api/heroes');
        const data = await res.json();
        if (data.status !== 'success') return;
        const datalist = document.getElementById('hero-list');
        datalist.innerHTML = '';
        data.data.heroes.forEach(hero => {
            const opt = document.createElement('option');
            opt.value = hero.name;
            if (hero.alias) opt.label = hero.alias;
            datalist.appendChild(opt);
        });
    } catch { /* silent */ }
}

async function checkService() {
    const pill = document.getElementById('service-status');
    const text = pill.querySelector('.status-pill__text');
    const banner = document.getElementById('service-banner');
    const lanBlock = document.getElementById('lan-access');
    const lanLink = document.getElementById('lan-url-link');

    try {
        const res = await fetch('/api/hero/status');
        const data = await res.json();
        if (data.status !== 'success') throw new Error('bad status');

        const d = data.data;
        const allOk = d.ready && d.online;

        pill.classList.toggle('is-online', allOk);
        pill.classList.toggle('is-warn', !allOk);
        text.textContent = allOk ? '服务就绪' : (d.online ? '部分就绪' : '繁忙');

        if (d.lan_url && lanLink && lanBlock) {
            lanLink.href = d.lan_url;
            lanLink.textContent = d.lan_url;
            lanBlock.classList.remove('hidden');
        }

        const issues = [];
        if (!d.mysql) issues.push('MySQL 未连接（排行榜/用户不可用）');
        if (!d.redis) issues.push('Redis 未连接（排行榜不可用）');
        if (!d.online) issues.push('战力查询服务繁忙');

        if (issues.length) {
            banner.classList.remove('hidden');
            banner.innerHTML = issues.map(m => `<span>${esc(m)}</span>`).join('');
        } else {
            banner.classList.add('hidden');
            banner.innerHTML = '';
        }
    } catch {
        pill.classList.add('is-warn');
        pill.classList.remove('is-online');
        text.textContent = '离线';
        banner.classList.remove('hidden');
        banner.innerHTML = '<span>无法连接服务器，请确认已运行 python app.py</span>';
    }
}

function showLoading() {
    const box = document.getElementById('hero-result');
    box.classList.remove('hidden');
    box.innerHTML = `
        <div class="result-panel">
            <div class="state-box">
                <div class="spinner"></div>
                <p>正在查询战力数据…</p>
            </div>
        </div>
    `;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function heroAvatarHtml(d) {
    const name = d.hero || '?';
    const initial = name.charAt(0);
    if (d.photo) {
        return `<img class="hero-avatar" src="${escAttr(d.photo)}" alt="${esc(name)}" loading="lazy"
            onerror="this.outerHTML='<div class=\\'hero-avatar fallback\\'><span>${esc(initial)}</span></div>'">`;
    }
    return `<div class="hero-avatar fallback"><span>${initial}</span></div>`;
}

function renderPowerCard(d) {
    const tiers = [
        { key: '国标', region: '全国', power: d.guobiao },
        { key: '省标', region: d.province, power: d.province_power },
        { key: '市标', region: d.city, power: d.city_power },
        { key: '区标', region: d.area, power: d.area_power, best: true },
    ].filter(t => t.power != null && t.power > 0);

    const areaTiers = tiers.filter(t => t.best);
    const minArea = areaTiers.length ? Math.min(...areaTiers.map(t => t.power)) : null;

    const cells = tiers.map(t => `
        <div class="tier-cell ${t.best && t.power === minArea ? 'is-best' : ''}">
            <div class="tier-cell__label">${t.key}</div>
            <div class="tier-cell__region">${esc(t.region || '—')}</div>
            <div class="tier-cell__value">${t.power}</div>
        </div>
    `).join('');

    return `
        <div class="result-panel">
            <div class="result-panel__head">
                ${heroAvatarHtml(d)}
                <div>
                    <h2 class="result-panel__name">${esc(d.hero)}</h2>
                    <p class="result-panel__alias">${esc(d.alias || '')}</p>
                    <span class="result-panel__tag">${esc(d.platform)}</span>
                </div>
            </div>
            <div class="tier-grid">${cells}</div>
            ${d.updated_at ? `<div class="result-panel__foot">数据更新 ${esc(d.updated_at)}</div>` : ''}
        </div>
    `;
}

async function querySingle(e) {
    e.preventDefault();
    const hero = document.getElementById('hero-name').value.trim();
    const type = getPlatform();
    if (!hero) return toast('请输入英雄名称', true);

    showLoading();
    try {
        const res = await fetch(`/api/hero/power?hero=${encodeURIComponent(hero)}&type=${encodeURIComponent(type)}`);
        const data = await res.json();
        const box = document.getElementById('hero-result');
        if (data.status !== 'success') {
            box.innerHTML = `<div class="result-panel"><div class="state-box state-box--error"><i class="fas fa-circle-exclamation"></i><p>${esc(friendlyError(data.message))}</p></div></div>`;
            return;
        }
        box.innerHTML = renderPowerCard(data.data);
    } catch {
        document.getElementById('hero-result').innerHTML =
            `<div class="result-panel"><div class="state-box state-box--error"><p>网络异常，请稍后重试</p></div></div>`;
    }
}

async function queryAllPlatforms() {
    const hero = document.getElementById('hero-name').value.trim();
    if (!hero) return toast('请输入英雄名称', true);

    showLoading();
    try {
        const res = await fetch(`/api/hero/power/all?hero=${encodeURIComponent(hero)}`);
        const data = await res.json();
        const box = document.getElementById('hero-result');
        if (data.status !== 'success') {
            box.innerHTML = `<div class="result-panel"><div class="state-box state-box--error"><p>${esc(friendlyError(data.message))}</p></div></div>`;
            return;
        }
        const { platforms, success_count } = data.data;

        let bestPtype = null;
        let bestPower = Infinity;
        for (const [ptype, p] of Object.entries(platforms)) {
            if (p.area_power && p.area_power < bestPower) {
                bestPower = p.area_power;
                bestPtype = ptype;
            }
        }

        let rows = '';
        for (const [ptype, name] of Object.entries(platformNames)) {
            const p = platforms[ptype];
            if (p) {
                const isBest = ptype === bestPtype;
                rows += `
                    <div class="compare-row ${isBest ? 'is-best' : ''}">
                        <div class="compare-row__left">
                            <strong>${name}</strong>
                            <span>${esc(p.area || '—')}</span>
                        </div>
                        <div class="compare-row__power">
                            ${isBest ? '<em>最低</em>' : ''}
                            <b>${p.area_power}</b>
                        </div>
                    </div>
                `;
        } else {
                rows += `<div class="compare-row is-dim"><div class="compare-row__left"><strong>${name}</strong><span>暂无数据</span></div></div>`;
            }
        }

        box.innerHTML = `
            <div class="result-panel">
                <div class="compare-panel">
                    <h2 class="compare-panel__title">${esc(hero)} · 大区对比</h2>
                    <p class="compare-panel__sub">已获取 ${success_count} 个大区数据</p>
                    <div class="compare-rows">${rows}</div>
                </div>
            </div>
        `;
    } catch {
        document.getElementById('hero-result').innerHTML =
            `<div class="result-panel"><div class="state-box state-box--error"><p>网络异常，请稍后重试</p></div></div>`;
    }
}

function friendlyError(msg) {
    if (!msg) return '未查询到结果，请检查英雄名称';
    return '查询未成功，请稍后重试';
}

function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => { el.className = 'toast'; }, 2800);
}

function esc(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function escAttr(str) {
    return esc(str).replace(/"/g, '&quot;');
}
