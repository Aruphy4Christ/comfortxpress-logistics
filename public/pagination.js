// pagination.js — shared pagination helpers for ComfortXpress admin pages.
// Include this after auth-guard.js. Exposes two globals: paginateItems() and
// renderPaginationControls(). No dependencies, framework-free, matches the
// vanilla-JS style already used across the admin pages.

/**
 * Slice `items` down to one page.
 * Clamps the requested page into a valid range automatically, so callers
 * never have to guard against an out-of-range page after the underlying
 * data set shrinks (e.g. an order moving out of the "Active" list).
 */
function paginateItems(items, page, pageSize) {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);

    return {
        pageItems,
        currentPage,
        totalPages,
        totalItems,
        rangeStart: totalItems === 0 ? 0 : start + 1,
        rangeEnd: Math.min(start + pageSize, totalItems),
    };
}

/**
 * Render "Showing X–Y of Z" + Prev/page-number/Next controls into containerEl.
 * onPageChange(pageNumber) is called whenever the user clicks a control.
 */
function renderPaginationControls(containerEl, paginationState, onPageChange) {
    const { currentPage, totalPages, totalItems, rangeStart, rangeEnd } = paginationState;

    if (totalItems === 0) {
        containerEl.innerHTML = '';
        return;
    }

    const WINDOW = 5;
    let from = Math.max(1, currentPage - Math.floor(WINDOW / 2));
    let to = Math.min(totalPages, from + WINDOW - 1);
    from = Math.max(1, to - WINDOW + 1);

    let numberButtons = '';
    for (let p = from; p <= to; p++) {
        numberButtons += `<button class="page-btn${p === currentPage ? ' page-btn-active' : ''}" data-page="${p}">${p}</button>`;
    }

    containerEl.innerHTML = `
        <div class="pagination-info">Showing ${rangeStart}&ndash;${rangeEnd} of ${totalItems}</div>
        <div class="pagination-controls">
            <button class="page-btn page-nav" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&lsaquo; Prev</button>
            ${numberButtons}
            <button class="page-btn page-nav" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next &rsaquo;</button>
        </div>
    `;

    containerEl.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const target = parseInt(btn.getAttribute('data-page'), 10);
            if (!Number.isNaN(target)) onPageChange(target);
        });
    });
}