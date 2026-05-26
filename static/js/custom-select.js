/**
 * 深色主题自定义下拉框（替代系统浅色 option 列表）
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

    const menu = document.createElement('div');
    menu.className = 'custom-select__menu hidden';
    menu.setAttribute('role', 'listbox');

    selectEl.insertAdjacentElement('afterend', trigger);
    trigger.insertAdjacentElement('afterend', menu);

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = !menu.classList.contains('is-open');
        closeAllCustomSelectMenus();
        if (open) openCustomSelectMenu(selectEl);
    });

    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-select__option');
        if (!item || item.classList.contains('is-disabled')) return;
        selectEl.value = item.dataset.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        closeCustomSelectMenu(selectEl);
        refreshCustomSelect(selectEl);
    });

    refreshCustomSelect(selectEl);
}

function refreshCustomSelect(selectEl) {
    const control = selectEl.closest('.custom-select');
    if (!control) return;

    const trigger = control.querySelector('.custom-select__trigger');
    const menu = control.querySelector('.custom-select__menu');
    if (!trigger || !menu) return;

    const selected = selectEl.options[selectEl.selectedIndex];
    const label = selected ? selected.textContent : '请选择';
    trigger.textContent = label;
    trigger.classList.toggle('is-placeholder', !selectEl.value);

    menu.innerHTML = '';
    Array.from(selectEl.options).forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'custom-select__option';
        btn.dataset.value = opt.value;
        btn.textContent = opt.textContent;
        btn.setAttribute('role', 'option');
        if (!opt.value) btn.classList.add('is-disabled');
        if (opt.selected) btn.classList.add('is-selected');
        menu.appendChild(btn);
    });
}

function openCustomSelectMenu(selectEl) {
    const control = selectEl.closest('.custom-select');
    const menu = control?.querySelector('.custom-select__menu');
    const trigger = control?.querySelector('.custom-select__trigger');
    if (!menu || !trigger) return;

    menu.classList.remove('hidden');
    menu.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    control.classList.add('is-open');
}

function closeCustomSelectMenu(selectEl) {
    const control = selectEl.closest('.custom-select');
    const menu = control?.querySelector('.custom-select__menu');
    const trigger = control?.querySelector('.custom-select__trigger');
    if (!menu || !trigger) return;

    menu.classList.add('hidden');
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    control.classList.remove('is-open');
}

function closeAllCustomSelectMenus() {
    document.querySelectorAll('.custom-select__menu.is-open').forEach((menu) => {
        const control = menu.closest('.custom-select');
        const selectEl = control?.querySelector('select');
        if (selectEl) closeCustomSelectMenu(selectEl);
    });
}

document.addEventListener('click', () => closeAllCustomSelectMenus());
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllCustomSelectMenus();
});
