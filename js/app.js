/* ============================================================
   js/app.js — Expense & Budget Visualizer
   Enhanced with: GeneratePress theme, custom categories,
   date tracking, monthly summary, sort, spend limit
   highlight, dark/light mode toggle.
   No modules, no imports, no build steps.
   ============================================================ */


/* ============================================================
   Constants & Category Management (Task 1 + Task 2)
   ============================================================ */

var BUILTIN_CATEGORIES = ['Food', 'Transport', 'Fun'];

var BUILTIN_COLORS = {
  Food:      '#e05c7a',
  Transport: '#2e86de',
  Fun:       '#f0a500'
};

// Extended color palette for auto-assigning to custom categories
var AUTO_COLORS = [
  '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#84cc16', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
];

/* ---- CategoryManager ---- */
var CategoryManager = {
  STORAGE_KEY: 'expense_custom_categories',

  // { name: string, color: string }[]
  customCategories: [],

  load: function () {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      this.customCategories = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this.customCategories = [];
    }
  },

  save: function () {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.customCategories));
    } catch (e) { /* silent */ }
  },

  all: function () {
    return BUILTIN_CATEGORIES.concat(
      this.customCategories.map(function (c) { return c.name; })
    );
  },

  colorFor: function (name) {
    if (BUILTIN_COLORS[name]) return BUILTIN_COLORS[name];
    var custom = this.customCategories.find(function (c) { return c.name === name; });
    return custom ? custom.color : '#8b5cf6';
  },

  add: function (name, color) {
    var trimmed = name.trim();
    if (!trimmed) return false;
    var exists = this.all().some(function (c) {
      return c.toLowerCase() === trimmed.toLowerCase();
    });
    if (exists) return false;
    this.customCategories.push({ name: trimmed, color: color });
    this.save();
    return true;
  },

  remove: function (name) {
    this.customCategories = this.customCategories.filter(function (c) {
      return c.name !== name;
    });
    this.save();
  }
};


/* ============================================================
   StorageManager
   ============================================================ */
var StorageManager = {
  STORAGE_KEY: 'expense_transactions',
  LIMIT_KEY:   'expense_spend_limit',
  THEME_KEY:   'expense_theme',

  load: function () {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      var banner = document.getElementById('storage-warning');
      if (banner) banner.removeAttribute('hidden');
      return [];
    }
  },

  save: function (transactions) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) { /* silent */ }
  },

  loadLimit: function () {
    try {
      var raw = localStorage.getItem(this.LIMIT_KEY);
      return raw !== null ? parseFloat(raw) : null;
    } catch (e) { return null; }
  },

  saveLimit: function (limit) {
    try {
      if (limit === null) {
        localStorage.removeItem(this.LIMIT_KEY);
      } else {
        localStorage.setItem(this.LIMIT_KEY, String(limit));
      }
    } catch (e) { /* silent */ }
  },

  loadTheme: function () {
    try {
      return localStorage.getItem(this.THEME_KEY) || 'light';
    } catch (e) { return 'light'; }
  },

  saveTheme: function (theme) {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch (e) { /* silent */ }
  }
};


/* ============================================================
   Transaction Factory (Task 3 — includes date)
   ============================================================ */
function createTransaction(name, amount, category, date) {
  return {
    id:        crypto.randomUUID(),
    name:      name.trim(),
    amount:    parseFloat(amount),
    category:  category,
    date:      date || new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    createdAt: new Date().toISOString()
  };
}


/* ============================================================
   Validator
   ============================================================ */
var Validator = {
  validate: function (name, amount, category) {
    var errors = {};

    if (!name || name.trim() === '') {
      errors.name = 'Item name is required.';
    }

    var parsed = parseFloat(amount);
    if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
      errors.amount = 'Please enter a positive amount.';
    }

    if (!CategoryManager.all().includes(category)) {
      errors.category = 'Please select a valid category.';
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }
};


/* ============================================================
   App State
   ============================================================ */
var AppState = {
  spendLimit:  null,   // number | null (Task 5)
  sortOrder:   'date-desc',  // Task 4
  monthFilter: null,   // 'YYYY-MM' | null (Task 3)
  theme:       'light' // Task 6
};


/* ============================================================
   Theme Manager (Task 6)
   ============================================================ */
var ThemeManager = {
  apply: function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    AppState.theme = theme;
    StorageManager.saveTheme(theme);
    var icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '\u2600' : '\u263E';
  },

  toggle: function () {
    ThemeManager.apply(AppState.theme === 'dark' ? 'light' : 'dark');
  },

  init: function () {
    var saved = StorageManager.loadTheme();
    // Also respect OS preference if no saved preference
    if (!localStorage.getItem(StorageManager.THEME_KEY)) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        saved = 'dark';
      }
    }
    ThemeManager.apply(saved);
  }
};


/* ============================================================
   Spend Limit Manager (Task 5)
   ============================================================ */
var LimitManager = {
  init: function () {
    AppState.spendLimit = StorageManager.loadLimit();
    LimitManager.updateDisplay();
  },

  updateDisplay: function () {
    var el = document.getElementById('limit-amount-display');
    if (!el) return;
    if (AppState.spendLimit !== null) {
      el.textContent = '$' + AppState.spendLimit.toFixed(2);
    } else {
      el.textContent = 'Not set';
    }
  },

  checkWarning: function (transactions) {
    var warning = document.getElementById('limit-warning');
    var text    = document.getElementById('limit-warning-text');
    if (!warning || !text) return;

    if (AppState.spendLimit === null) {
      warning.setAttribute('hidden', '');
      return;
    }

    var total = transactions.reduce(function (s, t) { return s + t.amount; }, 0);
    if (total > AppState.spendLimit) {
      var over = (total - AppState.spendLimit).toFixed(2);
      text.textContent = 'You are $' + over + ' over your $' + AppState.spendLimit.toFixed(2) + ' spending limit!';
      warning.removeAttribute('hidden');
    } else {
      warning.setAttribute('hidden', '');
    }
  },

  isOverLimit: function (transaction, allTransactions) {
    if (AppState.spendLimit === null) return false;
    // Find cumulative total up to and including this transaction (by createdAt order)
    var sorted = allTransactions.slice().sort(function (a, b) {
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    var running = 0;
    for (var i = 0; i < sorted.length; i++) {
      running += sorted[i].amount;
      if (sorted[i].id === transaction.id) {
        return running > AppState.spendLimit;
      }
    }
    return false;
  }
};


/* ============================================================
   Balance Renderer
   ============================================================ */
var BalanceRenderer = {
  render: function (transactions) {
    var total = transactions.reduce(function (s, t) { return s + t.amount; }, 0);
    var el = document.getElementById('balance-amount');
    if (el) el.textContent = '$' + total.toFixed(2);

    // Monthly total (Task 3)
    var now = new Date();
    var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var monthlyTotal = transactions
      .filter(function (t) { return (t.date || '').slice(0, 7) === thisMonth; })
      .reduce(function (s, t) { return s + t.amount; }, 0);
    var mel = document.getElementById('monthly-amount');
    if (mel) mel.textContent = '$' + monthlyTotal.toFixed(2);

    LimitManager.checkWarning(transactions);
  }
};


/* ============================================================
   Sort Helper (Task 4)
   ============================================================ */
function sortTransactions(transactions, order) {
  var arr = transactions.slice();
  switch (order) {
    case 'date-asc':
      return arr.sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
    case 'date-desc':
      return arr.sort(function (a, b) { return (a.date || '') > (b.date || '') ? -1 : 1; });
    case 'amount-desc':
      return arr.sort(function (a, b) { return b.amount - a.amount; });
    case 'amount-asc':
      return arr.sort(function (a, b) { return a.amount - b.amount; });
    case 'category-asc':
      return arr.sort(function (a, b) { return a.category.localeCompare(b.category); });
    default:
      return arr;
  }
}


/* ============================================================
   List Renderer (Task 3 + Task 4 + Task 5)
   ============================================================ */
var ListRenderer = {
  render: function (transactions) {
    var list = document.getElementById('transaction-list');
    if (!list) return;

    // Apply month filter (Task 3)
    var filtered = transactions;
    if (AppState.monthFilter) {
      filtered = transactions.filter(function (t) {
        return (t.date || '').slice(0, 7) === AppState.monthFilter;
      });
    }

    // Monthly summary bar (Task 3)
    var summaryEl    = document.getElementById('monthly-summary');
    var summaryLabel = document.getElementById('monthly-summary-label');
    var summaryTotal = document.getElementById('monthly-summary-total');
    if (AppState.monthFilter && summaryEl) {
      var mTotal = filtered.reduce(function (s, t) { return s + t.amount; }, 0);
      summaryLabel.textContent = AppState.monthFilter;
      summaryTotal.textContent = '$' + mTotal.toFixed(2) + ' total';
      summaryEl.removeAttribute('hidden');
    } else if (summaryEl) {
      summaryEl.setAttribute('hidden', '');
    }

    // Apply sort (Task 4)
    var sorted = sortTransactions(filtered, AppState.sortOrder);

    list.innerHTML = '';

    if (sorted.length === 0) {
      var li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = AppState.monthFilter
        ? 'No transactions for this month.'
        : 'No transactions recorded yet.';
      list.appendChild(li);
      return;
    }

    sorted.forEach(function (t) {
      var li = document.createElement('li');

      // Over-limit highlight (Task 5)
      if (LimitManager.isOverLimit(t, transactions)) {
        li.classList.add('over-limit');
      }

      // Name
      var nameSpan = document.createElement('span');
      nameSpan.className = 'transaction-name';
      nameSpan.textContent = t.name;

      // Date (Task 3)
      var dateSpan = document.createElement('span');
      dateSpan.className = 'transaction-date';
      if (t.date) {
        // Format as "Jan 15"
        try {
          var d = new Date(t.date + 'T00:00:00');
          dateSpan.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (e) {
          dateSpan.textContent = t.date;
        }
      }

      // Amount
      var amountSpan = document.createElement('span');
      amountSpan.className = 'transaction-amount';
      amountSpan.textContent = '$' + t.amount.toFixed(2);

      // Category badge
      var catSpan = document.createElement('span');
      catSpan.className = 'transaction-category';
      catSpan.setAttribute('data-category', t.category);
      catSpan.textContent = t.category;
      // Apply custom category color inline if not a builtin
      if (!BUILTIN_COLORS[t.category]) {
        catSpan.style.backgroundColor = CategoryManager.colorFor(t.category);
        catSpan.style.color = '#fff';
      }

      // Delete button
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.setAttribute('data-id', t.id);
      deleteBtn.setAttribute('aria-label', 'Delete ' + t.name);
      deleteBtn.textContent = 'Del';

      li.appendChild(nameSpan);
      li.appendChild(dateSpan);
      li.appendChild(amountSpan);
      li.appendChild(catSpan);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  }
};


/* ============================================================
   Chart Renderer
   ============================================================ */
var ChartRenderer = {
  chartInstance: null,

  render: function (transactions) {
    var canvas      = document.getElementById('spending-chart');
    var placeholder = document.getElementById('chart-placeholder');

    if (window.chartJsLoadFailed) {
      if (placeholder) {
        placeholder.textContent = 'Chart unavailable \u2014 could not load Chart.js.';
        placeholder.style.display = '';
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }

    if (transactions.length === 0) {
      if (this.chartInstance) { this.chartInstance.destroy(); this.chartInstance = null; }
      if (canvas)      canvas.style.display = 'none';
      if (placeholder) { placeholder.textContent = 'No data to display yet.'; placeholder.style.display = ''; }
      return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (canvas)      canvas.style.display = '';

    var allCats = CategoryManager.all();
    var labels   = [];
    var data     = [];
    var bgColors = [];

    allCats.forEach(function (cat) {
      var total = transactions
        .filter(function (t) { return t.category === cat; })
        .reduce(function (s, t) { return s + t.amount; }, 0);
      if (total > 0) {
        labels.push(cat);
        data.push(parseFloat(total.toFixed(2)));
        bgColors.push(CategoryManager.colorFor(cat));
      }
    });

    if (!this.chartInstance) {
      this.chartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 2 }]
        },
        options: {
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var val = ctx.parsed;
                  var total = ctx.dataset.data.reduce(function (s, v) { return s + v; }, 0);
                  var pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return ' $' + val.toFixed(2) + ' (' + pct + '%)';
                }
              }
            }
          }
        }
      });
    } else {
      this.chartInstance.data.labels                      = labels;
      this.chartInstance.data.datasets[0].data            = data;
      this.chartInstance.data.datasets[0].backgroundColor = bgColors;
      this.chartInstance.update();
    }
  }
};


/* ============================================================
   renderAll
   ============================================================ */
function renderAll() {
  BalanceRenderer.render(TransactionManager.transactions);
  ListRenderer.render(TransactionManager.transactions);
  ChartRenderer.render(TransactionManager.transactions);
}


/* ============================================================
   TransactionManager
   ============================================================ */
var TransactionManager = {
  transactions: [],

  init: function () {
    this.transactions = StorageManager.load();
    renderAll();
  },

  add: function (name, amount, category, date) {
    var t = createTransaction(name, amount, category, date);
    this.transactions.push(t);
    StorageManager.save(this.transactions);
    renderAll();
  },

  delete: function (id) {
    this.transactions = this.transactions.filter(function (t) { return t.id !== id; });
    StorageManager.save(this.transactions);
    renderAll();
  }
};


/* ============================================================
   Category Selector — sync <select> with CategoryManager (Task 2)
   ============================================================ */
function rebuildCategorySelect() {
  var select = document.getElementById('input-category');
  if (!select) return;

  var current = select.value;
  select.innerHTML = '<option value="">-- Select category --</option>';

  CategoryManager.all().forEach(function (cat) {
    var opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  // Restore selection if still valid
  if (CategoryManager.all().includes(current)) {
    select.value = current;
  }
}

function renderCustomCategoryList() {
  var ul = document.getElementById('custom-category-list');
  if (!ul) return;
  ul.innerHTML = '';

  CategoryManager.customCategories.forEach(function (cat) {
    var li = document.createElement('li');
    li.className = 'custom-category-item';
    li.style.backgroundColor = cat.color;

    var swatch = document.createElement('span');
    swatch.className = 'custom-category-swatch';

    var label = document.createElement('span');
    label.textContent = cat.name;

    var removeBtn = document.createElement('button');
    removeBtn.className = 'remove-category-btn';
    removeBtn.setAttribute('aria-label', 'Remove ' + cat.name);
    removeBtn.textContent = '\u00D7';
    removeBtn.setAttribute('data-cat', cat.name);

    li.appendChild(swatch);
    li.appendChild(label);
    li.appendChild(removeBtn);
    ul.appendChild(li);
  });
}


/* ============================================================
   FormController
   ============================================================ */
var FormController = {
  init: function () {
    var form = document.getElementById('transaction-form');
    if (!form) return;

    form.addEventListener('submit', function (e) { FormController.handleSubmit(e); });

    // Set today's date as default for date input
    var dateInput = document.getElementById('input-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    // Clear errors on field change
    var fields = [
      { id: 'input-name',     err: 'error-name' },
      { id: 'input-amount',   err: 'error-amount' },
      { id: 'input-category', err: 'error-category' },
      { id: 'input-date',     err: 'error-date' }
    ];
    fields.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (el) {
        el.addEventListener('input',  function () { FormController._clearError(f.err); });
        el.addEventListener('change', function () { FormController._clearError(f.err); });
      }
    });
  },

  handleSubmit: function (event) {
    event.preventDefault();

    var name     = document.getElementById('input-name').value;
    var amount   = document.getElementById('input-amount').value;
    var category = document.getElementById('input-category').value;
    var date     = document.getElementById('input-date').value;

    var result = Validator.validate(name, amount, category);

    if (!result.valid) {
      if (result.errors.name)     FormController._showError('error-name',     result.errors.name);
      if (result.errors.amount)   FormController._showError('error-amount',   result.errors.amount);
      if (result.errors.category) FormController._showError('error-category', result.errors.category);
      return;
    }

    TransactionManager.add(name, amount, category, date);
    FormController.reset();
  },

  reset: function () {
    var form = document.getElementById('transaction-form');
    if (form) form.reset();
    // Restore today's date after reset
    var dateInput = document.getElementById('input-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    ['error-name', 'error-amount', 'error-category', 'error-date'].forEach(function (id) {
      FormController._clearError(id);
    });
  },

  _showError: function (spanId, message) {
    var span = document.getElementById(spanId);
    if (span) { span.textContent = message; span.style.display = 'inline'; }
  },

  _clearError: function (spanId) {
    var span = document.getElementById(spanId);
    if (span) { span.textContent = ''; span.style.display = 'none'; }
  }
};


/* ============================================================
   Spend Limit Modal Controller (Task 5)
   ============================================================ */
var LimitModalController = {
  open: function () {
    var modal    = document.getElementById('limit-modal');
    var backdrop = document.getElementById('modal-backdrop');
    var input    = document.getElementById('limit-input');
    if (!modal || !backdrop) return;
    if (AppState.spendLimit !== null) input.value = AppState.spendLimit;
    else input.value = '';
    modal.removeAttribute('hidden');
    backdrop.removeAttribute('hidden');
    input.focus();
  },

  close: function () {
    var modal    = document.getElementById('limit-modal');
    var backdrop = document.getElementById('modal-backdrop');
    if (modal)    modal.setAttribute('hidden', '');
    if (backdrop) backdrop.setAttribute('hidden', '');
  },

  save: function () {
    var input = document.getElementById('limit-input');
    var val   = parseFloat(input.value);
    if (isNaN(val) || val <= 0) {
      input.focus();
      return;
    }
    AppState.spendLimit = val;
    StorageManager.saveLimit(val);
    LimitManager.updateDisplay();
    LimitModalController.close();
    renderAll();
  },

  remove: function () {
    AppState.spendLimit = null;
    StorageManager.saveLimit(null);
    LimitManager.updateDisplay();
    LimitModalController.close();
    renderAll();
  }
};


/* ============================================================
   Event Wiring & Bootstrap
   ============================================================ */

// Theme toggle (Task 6)
var themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', function () { ThemeManager.toggle(); });
}

// Delete delegation
var transactionList = document.getElementById('transaction-list');
if (transactionList) {
  transactionList.addEventListener('click', function (e) {
    var target = e.target;
    if (target && target.dataset.id) {
      TransactionManager.delete(target.dataset.id);
    }
  });
}

// Storage warning dismiss
var warningClose = document.getElementById('storage-warning-close');
if (warningClose) {
  warningClose.addEventListener('click', function () {
    var banner = document.getElementById('storage-warning');
    if (banner) banner.setAttribute('hidden', '');
  });
}

// Sort (Task 4)
var sortSelect = document.getElementById('sort-select');
if (sortSelect) {
  sortSelect.addEventListener('change', function () {
    AppState.sortOrder = sortSelect.value;
    ListRenderer.render(TransactionManager.transactions);
  });
}

// Month filter (Task 3)
var monthFilter = document.getElementById('month-filter');
if (monthFilter) {
  monthFilter.addEventListener('change', function () {
    AppState.monthFilter = monthFilter.value || null;
    ListRenderer.render(TransactionManager.transactions);
  });
}

var clearMonthBtn = document.getElementById('clear-month-filter');
if (clearMonthBtn) {
  clearMonthBtn.addEventListener('click', function () {
    if (monthFilter) monthFilter.value = '';
    AppState.monthFilter = null;
    ListRenderer.render(TransactionManager.transactions);
  });
}

// Spend limit modal (Task 5)
var editLimitBtn = document.getElementById('edit-limit-btn');
if (editLimitBtn) {
  editLimitBtn.addEventListener('click', function () { LimitModalController.open(); });
}

var saveLimitBtn = document.getElementById('save-limit-btn');
if (saveLimitBtn) {
  saveLimitBtn.addEventListener('click', function () { LimitModalController.save(); });
}

var removeLimitBtn = document.getElementById('remove-limit-btn');
if (removeLimitBtn) {
  removeLimitBtn.addEventListener('click', function () { LimitModalController.remove(); });
}

var cancelLimitBtn = document.getElementById('cancel-limit-btn');
if (cancelLimitBtn) {
  cancelLimitBtn.addEventListener('click', function () { LimitModalController.close(); });
}

var modalBackdrop = document.getElementById('modal-backdrop');
if (modalBackdrop) {
  modalBackdrop.addEventListener('click', function () { LimitModalController.close(); });
}

// Close modal on Escape
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') LimitModalController.close();
});

// Custom category manager toggle (Task 2)
var toggleCatBtn = document.getElementById('toggle-category-manager');
var catPanel     = document.getElementById('category-manager-panel');
if (toggleCatBtn && catPanel) {
  toggleCatBtn.addEventListener('click', function () {
    var hidden = catPanel.hasAttribute('hidden');
    if (hidden) {
      catPanel.removeAttribute('hidden');
      toggleCatBtn.setAttribute('aria-expanded', 'true');
    } else {
      catPanel.setAttribute('hidden', '');
      toggleCatBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// Add custom category (Task 2)
var addCatBtn = document.getElementById('add-category-btn');
if (addCatBtn) {
  addCatBtn.addEventListener('click', function () {
    var nameInput  = document.getElementById('new-category-name');
    var colorInput = document.getElementById('new-category-color');
    var name  = nameInput ? nameInput.value : '';
    var color = colorInput ? colorInput.value : '#8b5cf6';

    if (CategoryManager.add(name, color)) {
      if (nameInput) nameInput.value = '';
      rebuildCategorySelect();
      renderCustomCategoryList();
    } else {
      if (nameInput) {
        nameInput.style.borderColor = 'var(--color-danger)';
        setTimeout(function () { nameInput.style.borderColor = ''; }, 1500);
      }
    }
  });
}

// Remove custom category delegation (Task 2)
var customCatList = document.getElementById('custom-category-list');
if (customCatList) {
  customCatList.addEventListener('click', function (e) {
    var btn = e.target.closest('.remove-category-btn');
    if (btn) {
      var catName = btn.getAttribute('data-cat');
      CategoryManager.remove(catName);
      rebuildCategorySelect();
      renderCustomCategoryList();
      // Re-render chart in case that category had data
      ChartRenderer.render(TransactionManager.transactions);
    }
  });
}

// Allow pressing Enter in new-category-name to add
var newCatNameInput = document.getElementById('new-category-name');
if (newCatNameInput) {
  newCatNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (addCatBtn) addCatBtn.click();
    }
  });
}


/* ============================================================
   Bootstrap
   ============================================================ */
ThemeManager.init();
CategoryManager.load();
rebuildCategorySelect();
renderCustomCategoryList();
LimitManager.init();
FormController.init();
TransactionManager.init();
