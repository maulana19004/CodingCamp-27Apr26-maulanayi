# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement the Expense & Budget Visualizer as three files: `index.html`, `css/styles.css`, and `js/app.js`. The implementation follows a unidirectional data flow — every user action mutates the in-memory `transactions` array, persists it to `localStorage`, then re-renders all UI components. Chart.js is loaded via CDN. No build tools, no frameworks, no backend.

Tasks are ordered so each step produces working, integrated code. The app is wired together incrementally rather than assembled at the end.

---

## Tasks

- [x] 1. Create the HTML skeleton (`index.html`)
  - Add the `<!DOCTYPE html>` document with `<head>` metadata (charset, viewport, title)
  - Link `css/styles.css` via `<link>` tag
  - Add the Chart.js CDN `<script>` tag with an `onerror` handler that sets a global `window.chartJsLoadFailed = true` flag
  - Add the `<script src="js/app.js" defer>` tag
  - Create the Balance_Display section: a `<header>` or `<section>` with a heading label and a `<span id="balance-amount">` for the computed value
  - Create the Input_Form section: a `<form id="transaction-form">` containing a text input (`id="input-name"`), a number input (`id="input-amount"`), a `<select id="input-category">` with options Food / Transport / Fun, a submit button, and three inline error `<span>` elements (`id="error-name"`, `id="error-amount"`, `id="error-category"`) initially hidden
  - Create the Transaction_List section: a `<section>` with a heading and a `<ul id="transaction-list">`
  - Create the Chart section: a `<section>` with a heading, a `<canvas id="spending-chart">`, and a `<p id="chart-placeholder">` for the empty/fallback state
  - Add a dismissible warning banner `<div id="storage-warning" hidden>` for the storage-unavailable error state
  - Ensure all form inputs have associated `<label>` elements with matching `for` attributes
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 4.6, 6.1, 8.1, 8.5_

- [x] 2. Write base CSS (`css/styles.css`)
  - [x] 2.1 Define layout and typography foundations
    - Set a CSS reset / box-sizing rule and a base `font-size` of at least 14px on `body`
    - Define a centered, single-column page layout (max-width ~700px, auto margins) that works from 320px to 1920px without horizontal scrolling
    - Style the four main sections (Balance_Display, Input_Form, Transaction_List, Chart) as visually distinct cards with clear headings
    - _Requirements: 8.1, 8.2, 8.4_
  - [x] 2.2 Style the Balance_Display
    - Make the balance figure prominent (larger font, bold) and positioned at the top of the page
    - _Requirements: 3.5, 8.1_
  - [x] 2.3 Style the Input_Form
    - Style inputs, select, and submit button with sufficient padding and readable labels
    - Style the inline error `<span>` elements (red text, hidden by default via `display: none`)
    - Ensure text/background contrast meets WCAG 2.1 AA (≥ 4.5:1)
    - _Requirements: 1.5, 8.2, 8.3_
  - [x] 2.4 Style the Transaction_List
    - Make the `<ul>` scrollable with a fixed max-height (e.g., `max-height: 300px; overflow-y: auto`)
    - Style each list item to show name, amount, category, and a delete button on one row
    - Style the empty-state message (centered, muted text)
    - _Requirements: 2.1, 2.2, 2.6_
  - [x] 2.5 Style the Chart section and warning banner
    - Constrain the canvas to a reasonable size (e.g., max-width 400px, centered)
    - Style the chart placeholder text (centered, muted)
    - Style the storage-warning banner (dismissible, non-blocking — e.g., a top banner with a close button)
    - _Requirements: 4.5, 5.4, 8.5_

- [x] 3. Implement `js/app.js` — constants and data models
  - Define `CATEGORIES = ['Food', 'Transport', 'Fun']` and `CATEGORY_COLORS` map (`Food: '#FF6384'`, `Transport: '#36A2EB'`, `Fun: '#FFCE56'`)
  - Define the `createTransaction(name, amount, category)` factory that returns a Transaction object with `id` (`crypto.randomUUID()`), `name` (trimmed), `amount` (float), `category`, and `createdAt` (ISO 8601 string)
  - _Requirements: 1.2, 4.3, 6.1_

- [x] 4. Implement `StorageManager` in `js/app.js`
  - Implement `StorageManager.load()`: wrap `localStorage.getItem` and `JSON.parse` in `try/catch`; return parsed array on success, `[]` on any error; show the `#storage-warning` banner on error
  - Implement `StorageManager.save(transactions)`: serialise the array to JSON and write to `localStorage` under key `'expense_transactions'`
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. Implement `Validator` in `js/app.js`
  - Implement `Validator.validate(name, amount, category)` returning `{ valid, errors }`
  - Name rule: trim whitespace; reject if empty string
  - Amount rule: parse as float; reject if `NaN`, not finite, or `≤ 0`
  - Category rule: reject if not in `CATEGORIES`
  - _Requirements: 1.4, 1.5_

- [x] 6. Implement `BalanceRenderer` in `js/app.js`
  - Implement `BalanceRenderer.render(transactions)`: sum all `amount` fields and write the result to `#balance-amount` formatted as a currency string with two decimal places (e.g., `toFixed(2)` prefixed with `$` or equivalent)
  - Handle the zero-transaction case (display `$0.00`)
  - _Requirements: 3.1, 3.4, 3.5_

- [x] 7. Implement `ListRenderer` in `js/app.js`
  - Implement `ListRenderer.render(transactions)`: clear `#transaction-list` and re-render all entries
  - Each `<li>` must show the transaction name, amount (formatted to 2 decimal places), and category
  - Each `<li>` must include a `<button>` with `data-id` attribute set to the transaction `id` and an `aria-label` of `"Delete <name>"` for accessibility
  - When `transactions` is empty, render a single `<li>` (or `<p>`) with the empty-state message "No transactions recorded yet."
  - _Requirements: 2.1, 2.3, 2.4, 2.6, 8.3_

- [x] 8. Implement `ChartRenderer` in `js/app.js`
  - [x] 8.1 Implement chart initialisation and update logic
    - Check `window.chartJsLoadFailed` on first render; if true, show `#chart-placeholder` with text "Chart unavailable — could not load Chart.js." and return early
    - On first call with data, create a new `Chart` instance on `#spending-chart` (type `'pie'`)
    - On subsequent calls, update `chartInstance.data` and call `chartInstance.update()`
    - Aggregate transaction amounts by category to build the chart dataset
    - Use `CATEGORY_COLORS` for slice colors; include a legend
    - _Requirements: 4.1, 4.3, 4.4, 4.6_
  - [x] 8.2 Handle empty and CDN-failure states
    - When `transactions` is empty, destroy any existing chart instance, hide the canvas, and show `#chart-placeholder` with text "No data to display yet."
    - When transactions exist, hide `#chart-placeholder` and show the canvas
    - _Requirements: 4.5_

- [x] 9. Implement `TransactionManager` in `js/app.js`
  - Define `TransactionManager.transactions = []` as the single in-memory state array
  - Implement `TransactionManager.init()`: load from `StorageManager`, assign to `transactions`, call `renderAll()`
  - Implement `TransactionManager.add(name, amount, category)`: create a Transaction via `createTransaction`, push to `transactions`, call `StorageManager.save`, call `renderAll()`
  - Implement `TransactionManager.delete(id)`: filter out the entry with matching `id` (no-op if not found), call `StorageManager.save`, call `renderAll()`
  - Implement `renderAll()`: call `BalanceRenderer.render`, `ListRenderer.render`, and `ChartRenderer.render` with the current `transactions` array
  - _Requirements: 1.3, 2.3, 2.5, 3.2, 3.3, 4.2, 5.1, 5.2, 7.2_

- [x] 10. Implement `FormController` in `js/app.js`
  - Implement `FormController.init()`: attach a `submit` event listener to `#transaction-form`
  - Implement `FormController.handleSubmit(event)`: call `event.preventDefault()`, read field values, call `Validator.validate`, display inline errors on failure (set error `<span>` text and `display: inline`) or call `TransactionManager.add` and `FormController.reset()` on success
  - Implement `FormController.reset()`: reset the form fields to defaults and clear all error `<span>` elements
  - Clear each field's error message when the user modifies that field (attach `input`/`change` listeners that hide the corresponding error span)
  - _Requirements: 1.3, 1.4, 1.5, 1.6_

- [x] 11. Wire up delete event delegation and app initialisation in `js/app.js`
  - Attach a single `click` event listener to `#transaction-list` using event delegation; when a click target has a `data-id` attribute, call `TransactionManager.delete(target.dataset.id)`
  - At the bottom of `app.js`, call `FormController.init()` and `TransactionManager.init()` to bootstrap the app on page load
  - _Requirements: 2.5, 5.3_

- [x] 12. Final checkpoint — verify full integration
  - Ensure all UI components (Balance_Display, Transaction_List, Chart) update correctly on add and delete
  - Ensure data persists across page reloads (localStorage round-trip)
  - Ensure the storage-warning banner appears when localStorage is unavailable
  - Ensure the Chart.js CDN fallback message appears when the script fails to load
  - Ensure the empty-state messages display correctly when no transactions exist
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.3, 2.3, 2.5, 2.6, 3.2, 3.3, 4.2, 4.5, 5.3, 5.4, 7.2_

---

## Notes

- All logic lives in `js/app.js`; there are no modules, imports, or build steps
- `StorageManager`, `Validator`, `TransactionManager`, `BalanceRenderer`, `ListRenderer`, `ChartRenderer`, and `FormController` are plain objects or groups of functions defined in `app.js`
- Chart.js is the only external dependency and is loaded via CDN — the app must degrade gracefully if it fails to load
- Every add/delete operation must update all three UI components within 100ms (Requirements 3.2, 3.3, 4.2, 7.2)
- The `crypto.randomUUID()` API is available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+, Edge 92+)
