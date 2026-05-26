/**
 * 简洁自定义下拉 — 与输入框同宽、内容自适应高度
 */
const CS_ITEM_HEIGHT = 36;
const CS_MAX_VISIBLE = 5;

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
    scroll.className = 'custom-select__scroll';
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
    valueEl.textContent = selected ? selected.textContent : '请选择';
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

    fitCustomSelectMenuHeight(selectEl);
}

function fitCustomSelectMenuHeight(selectEl) {
    const control = selectEl.closest('.custom-select');
    const scroll = control?.querySelector('.custom-select__scroll');
    if (!scroll) return;

    const count = scroll.querySelectorAll('.custom-select__option:not(.is-disabled)').length;
    if (count <= CS_MAX_VISIBLE) {
        scroll.style.maxHeight = '';
        scroll.classList.remove('ui-scroll-hidden');
    } else {
        scroll.style.maxHeight = `${CS_MAX_VISIBLE * CS_ITEM_HEIGHT}px`;
        scroll.classList.add('ui-scroll-hidden');
    }
}

function scrollSelectedIntoView(selectEl) {
    const control = selectEl.closest('.custom-select');
    const scroll = control?.querySelector('.custom-select__scroll');
    const selected = scroll?.querySelector('.custom-select__option.is-selected');
    selected?.scrollIntoView({ block: 'nearest' });
}

function openCustomSelectMenu(selectEl) {
    const control = selectEl.closest('.custom-select');
    const menu = control?.querySelector('.custom-select__menu');
    const trigger = control?.querySelector('.custom-select__trigger');
    if (!menu || !trigger) return;

    fitCustomSelectMenuHeight(selectEl);
    menu.hidden = false;
    requestAnimationFrame(() => {
        menu.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        control.classList.add('is-open');
        scrollSelectedIntoView(selectEl);
    });
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
        if (!menu.classList.contains('is-open')) menu.hidden = true;
    };
    menu.addEventListener('transitionend', onEnd);
    setTimeout(() => {
        if (!menu.classList.contains('is-open')) menu.hidden = true;
    }, 220);
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

    if (!menu.classList.contains('is-open')) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            closeAllCustomSelectMenus();
            openCustomSelectMenu(selectEl);
        }
        return;
    }

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
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (idx < 0) idx = items.findIndex((el) => el.classList.contains('is-selected'));
        if (idx < 0) idx = 0;
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
