const PLATFORM_NAMES_FALLBACK = {
    aqq: '安卓 QQ',
    awx: '安卓微信',
    iqq: '苹果 QQ',
    iwx: '苹果微信',
};

const RECENT_HEROES_KEY = 'honor_zone_recent_heroes';
const MAX_RECENT_HEROES = 8;
const LEADERBOARD_PAGE = 20;

let platformNames = { ...PLATFORM_NAMES_FALLBACK };
let zonesCache = [];
let currentZoneId = null;
let currentZoneName = '';
let leaderboardEnd = LEADERBOARD_PAGE - 1;
let leaderboardHasMore = false;
let helpDrawerPrevFocus = null;

const DEFAULT_AVATAR = 'https://game.gtimg.cn/images/yxzj/img201606/heroimg/166/166.jpg';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadPlatforms();
    loadHeroList();
    renderRecentHeroes();
    checkService();

    document.getElementById('service-status').addEventListener('click', () => checkService(true));
    document.getElementById('service-status').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            checkService(true);
        }
    });

    loadZones();

    document.getElementById('hero-query-form').addEventListener('submit', querySingle);
    document.getElementById('query-all-btn').addEventListener('click', queryAllPlatforms);

    document.querySelectorAll('.chip[data-hero]').forEach(chip => {
        chip.addEventListener('click', () => pickHeroAndQuery(chip.dataset.hero));
    });

    document.getElementById('zone-select').addEventListener('change', onZoneChange);
    document.getElementById('refresh-leaderboard').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.classList.add('is-spinning');
        btn.addEventListener('animationend', () => btn.classList.remove('is-spinning'), { once: true });
        if (currentZoneId) loadLeaderboard(currentZoneId, false);
        else toast('请先选择战区', true);
    });

    document.getElementById('load-more-leaderboard').addEventListener('click', () => {
        if (currentZoneId && leaderboardHasMore) loadLeaderboard(currentZoneId, true);
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
    document.addEventListener('keydown', onGlobalKeydown);

    initAllCustomSelects();
});

/* ---------- Helpers ---------- */
function getApiHeaders(extra = {}) {
    const headers = { ...extra };
    const key = document.querySelector('meta[name="api-key"]')?.content?.trim();
    if (key) headers['X-API-Key'] = key;
    return headers;
}

async function apiJson(url, options = {}) {
    const headers = getApiHeaders(options.headers || {});
    const res = await fetch(url, { ...options, headers });
    let data;
    try {
        data = await res.json();
    } catch {
        const err = new Error('parse');
        err.status = res.status;
        throw err;
    }
    if (!res.ok || data?.status === 'error') {
        const err = new Error(data?.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.payload = data;
        throw err;
    }
    return data;
}

function friendlyError(msg, status) {
    if (msg === 'server' || msg === 'parse') return '网络或服务异常，请稍后重试';
    if (msg && status && status < 500) return msg;
    if (msg && /请提供|不能为空|无效|不存在|过于频繁|API 密钥|须以 http/i.test(msg)) return msg;
    if (!msg) return '未查询到结果，请检查英雄名称';
    return (status && status >= 500) ? '服务繁忙，请稍后重试' : (msg || '操作未成功，请稍后重试');
}

function setFormBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll('button, input, select').forEach(el => {
        el.disabled = busy;
    });
    form.classList.toggle('is-busy', busy);
}

function setBtnBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
        if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('is-busy');
        if (label) btn.innerHTML = `<span class="spinner-inline"></span> ${label}`;
    } else {
        btn.disabled = false;
        btn.classList.remove('is-busy');
        if (btn.dataset.origHtml) {
            btn.innerHTML = btn.dataset.origHtml;
            delete btn.dataset.origHtml;
        }
    }
}

/* ---------- Recent heroes ---------- */
function getRecentHeroes() {
    try {
        const raw = localStorage.getItem(RECENT_HEROES_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter(Boolean).slice(0, MAX_RECENT_HEROES) : [];
    } catch {
        return [];
    }
}

function saveRecentHero(name) {
    const hero = String(name || '').trim();
    if (!hero) return;
    const list = getRecentHeroes().filter(h => h !== hero);
    list.unshift(hero);
    localStorage.setItem(RECENT_HEROES_KEY, JSON.stringify(list.slice(0, MAX_RECENT_HEROES)));
    renderRecentHeroes();
}

function renderRecentHeroes() {
    const wrap = document.getElementById('recent-heroes-wrap');
    const box = document.getElementById('recent-heroes');
    const list = getRecentHeroes();
    if (!wrap || !box) return;
    if (!list.length) {
        wrap.classList.add('hidden');
        return;
    }
    wrap.classList.remove('hidden');
    box.innerHTML = list.map(h => `
        <button type="button" class="chip chip--recent" data-hero="${escAttr(h)}">${esc(h)}</button>
    `).join('');
    box.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => pickHeroAndQuery(chip.dataset.hero));
    });
}

function pickHeroAndQuery(hero) {
    switchTab('power');
    document.getElementById('hero-name').value = hero;
    document.getElementById('hero-query-form').requestSubmit();
}

/* ---------- Tabs ---------- */
function initTabs() {
    const tabs = [...document.querySelectorAll('.app-tabs__btn')];
    tabs.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        btn.addEventListener('keydown', (e) => {
            const idx = tabs.indexOf(btn);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                tabs[(idx + 1) % tabs.length].focus();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                tabs[(idx - 1 + tabs.length) % tabs.length].focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                tabs[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                tabs[tabs.length - 1].focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchTab(btn.dataset.tab);
            }
        });
    });
}

function switchTab(name) {
    document.querySelectorAll('.app-tabs__btn').forEach(btn => {
        const active = btn.dataset.tab === name;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.setAttribute('tabindex', active ? '0' : '-1');
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        const show = panel.id === `tab-${name}`;
        panel.classList.toggle('is-active', show);
        panel.classList.toggle('hidden', !show);
    });
    document.getElementById(`tab-btn-${name}`)?.focus({ preventScroll: true });
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
        const data = await apiJson('/api/platforms');
        if (data.status === 'success' && data.data.platforms?.length) {
            platforms = data.data.platforms;
        }
    } catch { /* fallback */ }

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
        const data = await apiJson('/api/zones');
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
        loadLeaderboard(currentZoneId, false);
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
    leaderboardEnd = LEADERBOARD_PAGE - 1;
    if (!currentZoneId) {
        document.getElementById('zone-name-label').textContent = '请选择战区';
        document.getElementById('leaderboard-body').innerHTML =
            '<tr><td colspan="4" class="rank-table__empty">请选择战区查看排行</td></tr>';
        document.getElementById('load-more-leaderboard').classList.add('hidden');
        return;
    }
    currentZoneName = sel.options[sel.selectedIndex].text;
    document.getElementById('zone-name-label').textContent = currentZoneName;
    loadLeaderboard(currentZoneId, false);
}

async function loadLeaderboard(zoneId, loadMore) {
    const body = document.getElementById('leaderboard-body');
    const moreBtn = document.getElementById('load-more-leaderboard');

    if (loadMore) {
        leaderboardEnd += LEADERBOARD_PAGE;
        moreBtn.disabled = true;
    } else {
        leaderboardEnd = LEADERBOARD_PAGE - 1;
        body.innerHTML = '<tr><td colspan="4" class="rank-table__loading"><span class="spinner-inline"></span> 加载中…</td></tr>';
        moreBtn.classList.add('hidden');
    }

    try {
        const data = await apiJson(
            `/api/leaderboard/zone/${zoneId}?start=0&end=${leaderboardEnd}`
        );
        if (data.status !== 'success') {
            body.innerHTML = `<tr><td colspan="4" class="rank-table__empty">${esc(data.message || '加载失败')}</td></tr>`;
            return;
        }
        if (data.data.zone_name) {
            currentZoneName = data.data.zone_name;
            document.getElementById('zone-name-label').textContent = currentZoneName;
        }
        leaderboardHasMore = !!data.data.has_more;
        displayLeaderboard(data.data.leaderboard || []);
        moreBtn.classList.toggle('hidden', !leaderboardHasMore);
    } catch (e) {
        if (!loadMore) {
            body.innerHTML = `<tr><td colspan="4" class="rank-table__empty">${esc(friendlyError(e.message, e.status))}</td></tr>`;
        } else {
            toast(friendlyError(e.message, e.status), true);
        }
    } finally {
        moreBtn.disabled = false;
    }
}

function displayLeaderboard(rows) {
    const body = document.getElementById('leaderboard-body');
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="4" class="rank-table__empty">该战区暂无排行数据，可在用户中心创建用户</td></tr>';
        return;
    }

    const html = rows.map(row => {
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

    body.innerHTML = html;
}

function formatScore(score) {
    const n = Number(score);
    if (Number.isNaN(n)) return '0';
    return n.toLocaleString('zh-CN');
}

async function createZone() {
    const input = document.getElementById('new-zone-name');
    const btn = document.getElementById('create-zone-btn');
    const name = input.value.trim();
    if (!name) return toast('请输入战区名称', true);

    setBtnBusy(btn, true, '创建中');
    try {
        const data = await apiJson('/api/zones', {
            method: 'POST',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name, level: 1 }),
        });
        if (data.status !== 'success') {
            toast(data.message || '创建失败', true);
            return;
        }
        toast(`战区「${data.data.name}」已创建`);
        input.value = '';
        await loadZones();
        if (data.data.id) {
            document.getElementById('zone-select').value = String(data.data.id);
            refreshCustomSelect(document.getElementById('zone-select'));
            currentZoneId = String(data.data.id);
            currentZoneName = data.data.name;
            document.getElementById('zone-name-label').textContent = currentZoneName;
            loadLeaderboard(currentZoneId, false);
        }
    } catch (e) {
        toast(friendlyError(e.message, e.status), true);
    } finally {
        setBtnBusy(btn, false);
    }
}

async function seedDemoData() {
    if (!confirm('将导入演示战区与用户（不删除已有数据），是否继续？')) return;

    const btn = document.getElementById('seed-demo-btn');
    setBtnBusy(btn, true, '导入中');
    try {
        const data = await apiJson('/api/seed', {
            method: 'POST',
            headers: getApiHeaders(),
        });
        if (data.status !== 'success') {
            toast(data.message || '导入失败', true);
            return;
        }
        const c = data.data || {};
        toast(`已导入：战区 ${c.zones || 0} 个，用户 ${c.users || 0} 个`);
        await loadZones();
        if (currentZoneId) loadLeaderboard(currentZoneId, false);
    } catch (e) {
        toast(friendlyError(e.message, e.status), true);
    } finally {
        setBtnBusy(btn, false);
    }
}

/* ---------- User ---------- */
async function createUser(e) {
    e.preventDefault();
    const form = e.target;
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

    setFormBusy(form, true);
    try {
        const data = await apiJson('/api/users', {
            method: 'POST',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload),
        });
        if (data.status !== 'success') {
            toast(data.message || '创建失败', true);
            return;
        }
        toast(`用户创建成功，ID：${data.data.id}`);
        document.getElementById('user-id').value = data.data.id;
        form.reset();
        const userZone = document.getElementById('user-zone');
        userZone.value = zoneId;
        refreshCustomSelect(userZone);
        if (String(currentZoneId) === zoneId) loadLeaderboard(zoneId, false);
    } catch (err) {
        toast(friendlyError(err.message, err.status), true);
    } finally {
        setFormBusy(form, false);
    }
}

async function updateScore(e) {
    e.preventDefault();
    const form = e.target;
    const user_id = parseInt(document.getElementById('user-id').value, 10);
    const score = parseInt(document.getElementById('score-delta').value, 10);

    if (!user_id || Number.isNaN(user_id)) return toast('请输入有效用户 ID', true);
    if (Number.isNaN(score)) return toast('请输入有效积分', true);

    setFormBusy(form, true);
    try {
        const data = await apiJson('/api/scores/update', {
            method: 'POST',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ user_id, score }),
        });
        if (data.status !== 'success') {
            toast(data.message || '更新失败', true);
            return;
        }
        toast(`积分已更新，当前总分：${data.data.new_score}`);
        document.getElementById('score-delta').value = '';
        if (currentZoneId) loadLeaderboard(currentZoneId, false);
    } catch (err) {
        toast(friendlyError(err.message, err.status), true);
    } finally {
        setFormBusy(form, false);
    }
}

async function lookupUser() {
    const userId = parseInt(document.getElementById('lookup-user-id').value, 10);
    const card = document.getElementById('user-profile-card');
    const btn = document.getElementById('lookup-user-btn');
    if (!userId || Number.isNaN(userId)) {
        toast('请输入有效用户 ID', true);
        return;
    }

    setBtnBusy(btn, true, '查询中');
    card.classList.remove('hidden');
    card.innerHTML = '<p class="profile-card__loading"><span class="spinner-inline"></span> 查询中…</p>';

    try {
        const data = await apiJson(`/api/users/${userId}`);
        if (data.status !== 'success') {
            card.innerHTML = `<p class="profile-card__empty">${esc(data.message || '未找到用户')}</p>`;
            return;
        }
        const u = data.data;
        const avatarSrc = u.avatar_url || DEFAULT_AVATAR;
        const winPct = u.win_rate != null ? `${Math.round(Number(u.win_rate) * 100)}%` : '—';
        const rankHtml = u.zone_rank
            ? `<li><span>战区排名</span><b class="profile-card__rank">第 ${u.zone_rank} 名${u.zone_total ? ` / ${u.zone_total} 人` : ''}</b></li>`
            : '';
        card.innerHTML = `
            <div class="profile-card__head">
                <img class="profile-card__avatar" src="${escAttr(avatarSrc)}" alt="${esc(u.nickname)}的头像"
                     onerror="this.src='${DEFAULT_AVATAR}'">
                <div>
                    <h4 class="profile-card__name">${esc(u.nickname)}</h4>
                    <p class="profile-card__id">ID ${u.id}</p>
                </div>
            </div>
            <ul class="profile-card__meta">
                <li><span>所属战区</span><b>${esc(u.zone_name || '未分配')}</b></li>
                ${rankHtml}
                <li><span>总积分</span><b class="profile-card__score">${formatScore(u.total_score)}</b></li>
                <li><span>英雄等级</span><b>${u.hero_level ?? '—'} <em class="profile-card__demo">演示</em></b></li>
                <li><span>胜率</span><b>${winPct} <em class="profile-card__demo">演示</em></b></li>
                <li><span>注册时间</span><b>${esc(formatDate(u.created_at))}</b></li>
            </ul>
        `;
        document.getElementById('user-id').value = u.id;
    } catch (e) {
        card.innerHTML = `<p class="profile-card__empty">${esc(friendlyError(e.message, e.status))}</p>`;
    } finally {
        setBtnBusy(btn, false);
    }
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    } catch {
        return iso;
    }
}

/* ---------- Hero power ---------- */
function getPlatform() {
    const checked = document.querySelector('input[name="platform"]:checked');
    return checked ? checked.value : 'aqq';
}

function onGlobalKeydown(e) {
    const drawer = document.getElementById('help-drawer');
    if (e.key === 'Escape' && drawer && !drawer.classList.contains('hidden')) {
        closeHelp();
    }
}

function openHelp() {
    const el = document.getElementById('help-drawer');
    helpDrawerPrevFocus = document.activeElement;
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('close-help')?.focus();
}

function closeHelp() {
    const el = document.getElementById('help-drawer');
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    helpDrawerPrevFocus?.focus?.();
}

async function loadHeroList() {
    try {
        const data = await apiJson('/api/heroes');
        if (data.status !== 'success') {
            toast('英雄列表加载失败，仍可手动输入', true);
            return;
        }
        const datalist = document.getElementById('hero-list');
        datalist.innerHTML = '';
        data.data.heroes.forEach(hero => {
            const opt = document.createElement('option');
            opt.value = hero.name;
            if (hero.alias) opt.label = hero.alias;
            datalist.appendChild(opt);
        });
    } catch {
        toast('英雄列表加载失败，仍可手动输入', true);
    }
}

async function checkService(manual = false) {
    const pill = document.getElementById('service-status');
    const text = pill.querySelector('.status-pill__text');
    const banner = document.getElementById('service-banner');
    const lanBlock = document.getElementById('lan-access');
    const lanLink = document.getElementById('lan-url-link');

    if (manual) {
        text.textContent = '检测中…';
        pill.classList.remove('is-online', 'is-warn');
    }

    try {
        const data = await apiJson('/api/hero/status');
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
        if (!d.mysql) issues.push('MySQL 未连接（排行榜/用户不可用，战力查询仍可用）');
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
        text.textContent = manual ? '点击重试' : '离线';
        banner.classList.remove('hidden');
        banner.innerHTML = '<span>无法连接服务器，请确认已运行 python app.py（点击状态可重试）</span>';
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

    const foot = d.updated_at
        ? `<div class="result-panel__foot"><i class="fas fa-clock"></i> 数据更新 ${esc(d.updated_at)} · 通常每周一刷新</div>`
        : '';

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
            ${foot}
        </div>
    `;
}

async function querySingle(e) {
    e.preventDefault();
    const form = e.target;
    const hero = document.getElementById('hero-name').value.trim();
    const type = getPlatform();
    if (!hero) return toast('请输入英雄名称', true);

    saveRecentHero(hero);
    setFormBusy(form, true);
    showLoading();
    try {
        const data = await apiJson(
            `/api/hero/power?hero=${encodeURIComponent(hero)}&type=${encodeURIComponent(type)}`
        );
        const box = document.getElementById('hero-result');
        if (data.status !== 'success') {
            box.innerHTML = `<div class="result-panel"><div class="state-box state-box--error"><i class="fas fa-circle-exclamation"></i><p>${esc(friendlyError(data.message))}</p></div></div>`;
            return;
        }
        box.innerHTML = renderPowerCard(data.data);
    } catch (err) {
        document.getElementById('hero-result').innerHTML =
            `<div class="result-panel"><div class="state-box state-box--error"><p>${esc(friendlyError(err.message, err.status))}</p></div></div>`;
    } finally {
        setFormBusy(form, false);
    }
}

async function queryAllPlatforms() {
    const form = document.getElementById('hero-query-form');
    const hero = document.getElementById('hero-name').value.trim();
    if (!hero) return toast('请输入英雄名称', true);

    saveRecentHero(hero);
    setFormBusy(form, true);
    showLoading();
    try {
        const data = await apiJson(`/api/hero/power/all?hero=${encodeURIComponent(hero)}`);
        const box = document.getElementById('hero-result');
        if (data.status !== 'success') {
            box.innerHTML = `<div class="result-panel"><div class="state-box state-box--error"><p>${esc(friendlyError(data.message))}</p></div></div>`;
            return;
        }
        const { platforms, success_count } = data.data;

        let bestPtype = null;
        let bestPower = Infinity;
        let bestArea = '';
        for (const [ptype, p] of Object.entries(platforms)) {
            if (p.area_power && p.area_power < bestPower) {
                bestPower = p.area_power;
                bestPtype = ptype;
                bestArea = p.area || '';
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
                            ${isBest ? '<em>最低区标</em>' : ''}
                            <b>${p.area_power}</b>
                        </div>
                    </div>
                `;
            } else {
                rows += `<div class="compare-row is-dim"><div class="compare-row__left"><strong>${name}</strong><span>暂无数据</span></div></div>`;
            }
        }

        const hint = bestPtype
            ? `<p class="compare-panel__hint"><i class="fas fa-lightbulb"></i> 相对最低区标：<strong>${esc(platformNames[bestPtype])}</strong> · ${esc(bestArea)}（${bestPower}），仅供参考</p>`
            : '';

        box.innerHTML = `
            <div class="result-panel">
                <div class="compare-panel">
                    <h2 class="compare-panel__title">${esc(hero)} · 大区对比</h2>
                    <p class="compare-panel__sub">已获取 ${success_count} 个大区数据</p>
                    ${hint}
                    <div class="compare-rows">${rows}</div>
                </div>
            </div>
        `;
    } catch (err) {
        document.getElementById('hero-result').innerHTML =
            `<div class="result-panel"><div class="state-box state-box--error"><p>${esc(friendlyError(err.message, err.status))}</p></div></div>`;
    } finally {
        setFormBusy(form, false);
    }
}

function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' error' : '');
    el.setAttribute('role', 'alert');
    setTimeout(() => {
        el.className = 'toast';
        el.setAttribute('role', 'status');
    }, 2800);
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
