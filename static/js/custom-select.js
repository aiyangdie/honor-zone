/**
 * 深色主题自定义下拉 — 固定定位浮层、无滚动条、平滑开合
 */
function initAllCustomSelects() {
    document.querySelectorAll('select[data-custom-select]').forEach(initCustomSelect);
}

function initCustomSelect(selectEl) {
    if (selectEl.dataset.csReady === '1') {
        refreshCustomSelect(selectEl);
        return;
    }

    const control = selectEl.closest('.field__control--select');
    if (!control) return;

    control.classList.add('custom-select');
    selectEl.classList.add('custom-select__native');
    selectEl.dataset.csReady = '1';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML =
        '<span class="custom-select__value"></span>' +
        '<span class="custom-select__chevron" aria-hidden="true"></span>';

    const menu = document.createElement('div');
    menu.className = 'custom-select__menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    const scroll = document.createElement('div');
    scroll.className = 'custom-select__scroll ui-scroll-hidden';
    menu.appendChild(scroll);

    selectEl.insertAdjacentElement('afterend', trigger);
    trigger.insertAdjacentElement('afterend', menu);

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (menu.classList.contains('is-open')) {
            closeCustomSelectMenu(selectEl);
        } else {
            closeAllCustomSelectMenus();
            openCustomSelectMenu(selectEl);
        }
    });

    scroll.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-select__option');
        if (!item || item.classList.contains('is-disabled')) return;
        e.stopPropagation();
        selectEl.value = item.dataset.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        closeCustomSelectMenu(selectEl);
        refreshCustomSelect(selectEl);
    });

    trigger.addEventListener('keydown', (e) => onCustomSelectKeydown(e, selectEl));

    refreshCustomSelect(selectEl);
}

function refreshCustomSelect(selectEl) {
    const control = selectEl.closest('.custom-select');
    if (!control) return;

    const trigger = control.querySelector('.custom-select__trigger');
    const scroll = control.querySelector('.custom-select__scroll');
    const valueEl = control.querySelector('.custom-select__value');
    if (!trigger || !scroll || !valueEl) return;

    const selected = selectEl.options[selectEl.selectedIndex];
    const label = selected ? selected.textContent : '请选择';
    valueEl.textContent = label;
    trigger.classList.toggle('is-placeholder', !selectEl.value);

    const hasReal = Array.from(selectEl.options).some((o) => o.value);
    scroll.innerHTML = '';

    Array.from(selectEl.options).forEach((opt) => {
        if (!opt.value && hasReal) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'custom-select__option';
        btn.dataset.value = opt.value;
        btn.textContent = opt.textContent;
        btn.setAttribute('role', 'option');
        if (!opt.value) btn.classList.add('is-disabled');
        if (opt.selected) btn.classList.add('is-selected');
        scroll.appendChild(btn);
    });
}

function positionCustomSelectMenu(selectEl) {
    const control = selectEl.closest('.custom-select');
    const trigger = control?.querySelector('.custom-select__trigger');
    const menu = control?.querySelector('.custom-select__menu');
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const maxH = Math.min(280, window.innerHeight - rect.bottom - gap - 16);
    const scroll = menu.querySelector('.custom-select__scroll');

    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.width = `${Math.round(rect.width)}px`;
    menu.style.top = `${Math.round(rect.bottom + gap)}px`;
    menu.style.maxHeight = `${Math.max(120, maxH)}px`;
    if (scroll) scroll.style.maxHeight = `${Math.max(100, maxH - 12)}px`;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 160 && spaceAbove > spaceBelow) {
        menu.classList.add('is-flip');
        const h = menu.offsetHeight || maxH;
        menu.style.top = `${Math.round(rect.top - gap - h)}px`;
    } else {
        menu.classList.remove('is-flip');
    }
}

function scrollSelectedIntoView(selectEl) {
    const control = selectEl.closest('.custom-select');
    const scroll = control?.querySelector('.custom-select__scroll');
    const selected = scroll?.querySelector('.custom-select__option.is-selected');
    selected?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function openCustomSelectMenu(selectEl) {
    const control = selectEl.closest('.custom-select');
    const menu = control?.querySelector('.custom-select__menu');
    const trigger = control?.querySelector('.custom-select__trigger');
    if (!menu || !trigger) return;

    menu.hidden = false;
    positionCustomSelectMenu(selectEl);
    requestAnimationFrame(() => {
        menu.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        control.classList.add('is-open');
        requestAnimationFrame(() => {
            positionCustomSelectMenu(selectEl);
            scrollSelectedIntoView(selectEl);
        });
    });

    if (!selectEl._csReposition) {
        selectEl._csReposition = () => {
            if (menu.classList.contains('is-open')) positionCustomSelectMenu(selectEl);
        };
        window.addEventListener('resize', selectEl._csReposition);
        window.addEventListener('scroll', selectEl._csReposition, true);
    }
}

function closeCustomSelectMenu(selectEl) {
    const control = selectEl.closest('.custom-select');
    const menu = control?.querySelector('.custom-select__menu');
    const trigger = control?.querySelector('.custom-select__trigger');
    if (!menu || !trigger) return;

    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    control.classList.remove('is-open');

    const onEnd = (e) => {
        if (e.propertyName !== 'opacity') return;
        menu.removeEventListener('transitionend', onEnd);
        if (!menu.classList.contains('is-open')) {
            menu.hidden = true;
            menu.style.left = '';
            menu.style.top = '';
            menu.style.width = '';
            menu.style.maxHeight = '';
        }
    };
    menu.addEventListener('transitionend', onEnd);
    setTimeout(() => {
        if (!menu.classList.contains('is-open') && !menu.hidden) menu.hidden = true;
    }, 280);
}

function closeAllCustomSelectMenus() {
    document.querySelectorAll('.custom-select.is-open').forEach((control) => {
        const selectEl = control.querySelector('select');
        if (selectEl) closeCustomSelectMenu(selectEl);
    });
}

function onCustomSelectKeydown(e, selectEl) {
    const control = selectEl.closest('.custom-select');
    const menu = control?.querySelector('.custom-select__menu');
    const scroll = control?.querySelector('.custom-select__scroll');
    if (!menu || !scroll) return;

    const items = [...scroll.querySelectorAll('.custom-select__option:not(.is-disabled)')];
    if (!items.length) return;

    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (menu.classList.contains('is-open')) {
            closeCustomSelectMenu(selectEl);
        } else {
            closeAllCustomSelectMenus();
            openCustomSelectMenu(selectEl);
        }
        return;
    }

    if (!menu.classList.contains('is-open')) return;

    let idx = items.findIndex((el) => el.classList.contains('is-focused'));
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = idx < items.length - 1 ? idx + 1 : 0;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = idx > 0 ? idx - 1 : items.length - 1;
    } else if (e.key === 'Escape') {
        closeCustomSelectMenu(selectEl);
        return;
    } else if (e.key === 'Enter' && idx >= 0) {
        e.preventDefault();
        selectEl.value = items[idx].dataset.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        closeCustomSelectMenu(selectEl);
        refreshCustomSelect(selectEl);
        return;
    } else return;

    items.forEach((el) => el.classList.remove('is-focused'));
    items[idx].classList.add('is-focused');
    items[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

document.addEventListener('click', (e) => {
    if (e.target.closest('.custom-select__menu') || e.target.closest('.custom-select__trigger')) return;
    closeAllCustomSelectMenus();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllCustomSelectMenus();
});
