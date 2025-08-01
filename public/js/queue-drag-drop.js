// Queue Drag & Drop Management System
// ===================================

class QueueDragDropManager {
    constructor() {
        this.draggedElement = null;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.swipeThreshold = 100;
        
        // Keyboard navigation state
        this.selectedCard = null;
        this.selectedColumn = null;
        this.keyboardMode = false;
        this.announcements = document.createElement('div');
        this.announcements.setAttribute('aria-live', 'polite');
        this.announcements.setAttribute('aria-atomic', 'true');
        this.announcements.className = 'queue-announcements';
        document.body.appendChild(this.announcements);
        
        this.init();
    }

    init() {
        // Initialize drag and drop for desktop
        this.initDragAndDrop();
        
        // Initialize touch events for mobile
        this.initTouchEvents();
        
        // Initialize keyboard navigation
        this.initKeyboardNavigation();
        
        // Initialize WebSocket updates
        this.initRealtimeUpdates();
        
        // Initialize quick actions
        this.initQuickActions();
        
        // Initialize ARIA labels and accessibility features
        this.initAccessibilityFeatures();
    }

    initDragAndDrop() {
        // Get all draggable cards
        const cards = document.querySelectorAll('.queue-card');
        const columns = document.querySelectorAll('.queue-column');

        cards.forEach(card => {
            card.draggable = true;
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-describedby', 'keyboard-instructions');
            
            const customerName = card.querySelector('.customer-name')?.textContent || 'Customer';
            const status = card.dataset.status || 'waiting';
            card.setAttribute('aria-label', `${customerName}, status: ${status}. Press Enter to select for keyboard navigation, or use mouse to drag.`);

            card.addEventListener('dragstart', (e) => {
                this.draggedElement = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.innerHTML);
                this.announce(`Started dragging ${customerName}`);
            });

            card.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                this.draggedElement = null;
                this.announce(`Finished dragging ${customerName}`);
            });
        });

        columns.forEach(column => {
            const dropZone = column.querySelector('.queue-items');

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const afterElement = this.getDragAfterElement(dropZone, e.clientY);
                if (afterElement == null) {
                    dropZone.appendChild(this.createPlaceholder());
                } else {
                    dropZone.insertBefore(this.createPlaceholder(), afterElement);
                }
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.removePlaceholders();
                
                if (this.draggedElement && dropZone !== this.draggedElement.parentNode) {
                    const afterElement = this.getDragAfterElement(dropZone, e.clientY);
                    
                    if (afterElement == null) {
                        dropZone.appendChild(this.draggedElement);
                    } else {
                        dropZone.insertBefore(this.draggedElement, afterElement);
                    }
                    
                    // Update status based on column
                    this.updateCardStatus(this.draggedElement, column);
                    
                    // Animate the drop
                    this.animateCardDrop(this.draggedElement);
                    
                    // Send update to server
                    this.sendStatusUpdate(this.draggedElement, column);
                }
            });

            dropZone.addEventListener('dragleave', (e) => {
                if (!dropZone.contains(e.relatedTarget)) {
                    this.removePlaceholders();
                }
            });
        });
    }

    initKeyboardNavigation() {
        // Create keyboard instructions element
        const instructions = document.createElement('div');
        instructions.id = 'keyboard-instructions';
        instructions.className = 'sr-only';
        instructions.textContent = 'Use arrow keys to navigate, Enter to select/move, Space for actions, Escape to cancel';
        document.body.appendChild(instructions);

        // Global keyboard event listener
        document.addEventListener('keydown', (e) => {
            if (this.handleGlobalKeyboard(e)) {
                e.preventDefault();
            }
        });

        // Add keyboard listeners to cards
        document.querySelectorAll('.queue-card').forEach(card => {
            card.addEventListener('keydown', (e) => {
                if (this.handleCardKeyboard(e, card)) {
                    e.preventDefault();
                }
            });
        });
    }

    handleGlobalKeyboard(e) {
        // Enable keyboard mode on first keyboard interaction
        if (!this.keyboardMode) {
            this.keyboardMode = true;
            document.body.classList.add('keyboard-navigation');
        }

        switch (e.key) {
            case 'Escape':
                this.clearSelection();
                return true;
            case '?':
                if (e.shiftKey) {
                    this.showKeyboardHelp();
                    return true;
                }
                break;
            case 'F1':
                this.showKeyboardHelp();
                return true;
        }

        // Handle keyboard navigation when a card is selected
        if (this.selectedCard) {
            return this.handleSelectedCardKeyboard(e);
        }

        return false;
    }

    handleCardKeyboard(e, card) {
        switch (e.key) {
            case 'Enter':
            case ' ':
                this.selectCard(card);
                return true;
            case 'ArrowUp':
                this.navigateCards(card, 'up');
                return true;
            case 'ArrowDown':
                this.navigateCards(card, 'down');
                return true;
            case 'ArrowLeft':
                this.navigateColumns(card, 'left');
                return true;
            case 'ArrowRight':
                this.navigateColumns(card, 'right');
                return true;
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    this.handleCall(card);
                    return true;
                }
                break;
            case 'm':
                if (e.ctrlKey || e.metaKey) {
                    this.handleMessage(card);
                    return true;
                }
                break;
            case 'Delete':
            case 'Backspace':
                this.handleNoShow(card);
                return true;
        }
        return false;
    }

    handleSelectedCardKeyboard(e) {
        switch (e.key) {
            case 'ArrowLeft':
                this.navigateColumnsWithSelection('left');
                return true;
            case 'ArrowRight':
                this.navigateColumnsWithSelection('right');
                return true;
            case 'Enter':
                this.moveSelectedCard();
                return true;
            case 'Escape':
                this.clearSelection();
                return true;
        }
        return false;
    }

    selectCard(card) {
        this.clearSelection();
        this.selectedCard = card;
        card.setAttribute('data-keyboard-selected', 'true');
        card.setAttribute('aria-selected', 'true');
        
        const customerName = card.querySelector('.customer-name')?.textContent || 'Customer';
        this.announce(`Selected ${customerName}. Use left and right arrows to choose destination column, Enter to move, Escape to cancel.`);
        
        // Highlight possible drop zones
        document.querySelectorAll('.queue-column').forEach(column => {
            if (column !== card.closest('.queue-column')) {
                column.classList.add('drop-zone-hint');
            }
        });
    }

    clearSelection() {
        if (this.selectedCard) {
            this.selectedCard.removeAttribute('data-keyboard-selected');
            this.selectedCard.removeAttribute('aria-selected');
            this.selectedCard = null;
        }
        
        this.selectedColumn = null;
        
        // Remove drop zone hints
        document.querySelectorAll('.queue-column').forEach(column => {
            column.classList.remove('drop-zone-hint');
            column.removeAttribute('data-drop-target');
        });
        
        this.announce('Selection cleared');
    }

    navigateCards(currentCard, direction) {
        const column = currentCard.closest('.queue-column');
        const cards = Array.from(column.querySelectorAll('.queue-card'));
        const currentIndex = cards.indexOf(currentCard);
        
        let nextIndex;
        if (direction === 'up') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : cards.length - 1;
        } else {
            nextIndex = currentIndex < cards.length - 1 ? currentIndex + 1 : 0;
        }
        
        if (cards[nextIndex]) {
            cards[nextIndex].focus();
        }
    }

    navigateColumns(currentCard, direction) {
        const currentColumn = currentCard.closest('.queue-column');
        const columns = Array.from(document.querySelectorAll('.queue-column'));
        const currentIndex = columns.indexOf(currentColumn);
        
        let nextIndex;
        if (direction === 'left') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : columns.length - 1;
        } else {
            nextIndex = currentIndex < columns.length - 1 ? currentIndex + 1 : 0;
        }
        
        const nextColumn = columns[nextIndex];
        const firstCard = nextColumn.querySelector('.queue-card');
        if (firstCard) {
            firstCard.focus();
        }
    }

    navigateColumnsWithSelection(direction) {
        const columns = Array.from(document.querySelectorAll('.queue-column'));
        const currentColumn = this.selectedColumn || this.selectedCard.closest('.queue-column');
        const currentIndex = columns.indexOf(currentColumn);
        
        let nextIndex;
        if (direction === 'left') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : columns.length - 1;
        } else {
            nextIndex = currentIndex < columns.length - 1 ? currentIndex + 1 : 0;
        }
        
        // Clear previous selection
        document.querySelectorAll('.queue-column').forEach(col => {
            col.removeAttribute('data-drop-target');
        });
        
        // Highlight new target column
        this.selectedColumn = columns[nextIndex];
        this.selectedColumn.setAttribute('data-drop-target', 'true');
        
        const columnStatus = this.selectedColumn.dataset.status || 'unknown';
        const customerName = this.selectedCard.querySelector('.customer-name')?.textContent || 'Customer';
        this.announce(`Target column: ${columnStatus}. Press Enter to move ${customerName} here.`);
    }

    moveSelectedCard() {
        if (!this.selectedCard || !this.selectedColumn) {
            this.announce('Please select a destination column first');
            return;
        }
        
        const sourceColumn = this.selectedCard.closest('.queue-column');
        if (sourceColumn === this.selectedColumn) {
            this.announce('Card is already in this column');
            return;
        }
        
        const dropZone = this.selectedColumn.querySelector('.queue-items');
        const customerName = this.selectedCard.querySelector('.customer-name')?.textContent || 'Customer';
        const newStatus = this.selectedColumn.dataset.status;
        
        // Move the card
        dropZone.appendChild(this.selectedCard);
        this.updateCardStatus(this.selectedCard, this.selectedColumn);
        this.animateCardDrop(this.selectedCard);
        
        // Send update to server
        this.sendStatusUpdate(this.selectedCard, this.selectedColumn);
        
        this.announce(`Moved ${customerName} to ${newStatus} column`);
        this.clearSelection();
        
        // Focus the moved card
        this.selectedCard.focus();
    }

    showKeyboardHelp() {
        const helpModal = document.createElement('div');
        helpModal.className = 'keyboard-help-modal';
        helpModal.setAttribute('role', 'dialog');
        helpModal.setAttribute('aria-labelledby', 'help-title');
        helpModal.setAttribute('aria-describedby', 'help-content');
        
        helpModal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <h2 id="help-title">Keyboard Navigation Help</h2>
                <div id="help-content">
                    <h3>Card Navigation</h3>
                    <ul>
                        <li><kbd>↑</kbd> <kbd>↓</kbd> - Navigate between cards in same column</li>
                        <li><kbd>←</kbd> <kbd>→</kbd> - Navigate between columns</li>
                        <li><kbd>Enter</kbd> or <kbd>Space</kbd> - Select card for moving</li>
                    </ul>
                    
                    <h3>Moving Cards</h3>
                    <ul>
                        <li><kbd>←</kbd> <kbd>→</kbd> - Choose destination column (when card selected)</li>
                        <li><kbd>Enter</kbd> - Move selected card to highlighted column</li>
                        <li><kbd>Escape</kbd> - Cancel selection</li>
                    </ul>
                    
                    <h3>Quick Actions</h3>
                    <ul>
                        <li><kbd>Ctrl+C</kbd> - Call customer</li>
                        <li><kbd>Ctrl+M</kbd> - Send message</li>
                        <li><kbd>Delete</kbd> - Mark as no-show</li>
                    </ul>
                    
                    <h3>General</h3>
                    <ul>
                        <li><kbd>?</kbd> or <kbd>F1</kbd> - Show this help</li>
                        <li><kbd>Escape</kbd> - Close modals/cancel actions</li>
                    </ul>
                </div>
                <button onclick="this.closest('.keyboard-help-modal').remove()" autofocus>Close</button>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        helpModal.querySelector('button').focus();
    }

    announce(message) {
        this.announcements.textContent = message;
        
        // Also show visual notification for debugging
        if (document.body.classList.contains('accessibility-debug')) {
            console.log('Screen reader announcement:', message);
        }
    }

    initAccessibilityFeatures() {
        // Add ARIA labels to columns
        document.querySelectorAll('.queue-column').forEach(column => {
            const status = column.dataset.status || 'unknown';
            const count = column.querySelectorAll('.queue-card').length;
            column.setAttribute('role', 'region');
            column.setAttribute('aria-label', `${status} queue with ${count} customers`);
            
            // Add heading to each column if not present
            let heading = column.querySelector('h2, h3, .column-title');
            if (!heading) {
                heading = document.createElement('h3');
                heading.className = 'sr-only';
                heading.textContent = `${status.charAt(0).toUpperCase() + status.slice(1)} Queue`;
                column.insertBefore(heading, column.firstChild);
            }
        });
        
        // Add live region for queue updates
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'false');
        liveRegion.className = 'aria-live-region';
        liveRegion.id = 'queue-updates';
        document.body.appendChild(liveRegion);
        
        // Update ARIA labels when cards change
        this.updateAriaLabels();
    }

    updateAriaLabels() {
        // Update column counts and labels
        document.querySelectorAll('.queue-column').forEach(column => {
            const status = column.dataset.status || 'unknown';
            const count = column.querySelectorAll('.queue-card').length;
            column.setAttribute('aria-label', `${status} queue with ${count} customers`);
        });
        
        // Update card positions and context
        document.querySelectorAll('.queue-card').forEach((card, index) => {
            const column = card.closest('.queue-column');
            const status = column.dataset.status || 'unknown';
            const customerName = card.querySelector('.customer-name')?.textContent || 'Customer';
            const position = index + 1;
            const total = column.querySelectorAll('.queue-card').length;
            
            card.setAttribute('aria-label', 
                `${customerName}, position ${position} of ${total} in ${status} queue. ` +
                `Press Enter to select for keyboard navigation.`
            );
        });
    }

    initTouchEvents() {
        const cards = document.querySelectorAll('.queue-card');
        
        cards.forEach(card => {
            let currentX = 0;
            let initialX = 0;
            let xOffset = 0;
            let active = false;

            card.addEventListener('touchstart', (e) => {
                initialX = e.touches[0].clientX - xOffset;
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
                active = true;
            });

            card.addEventListener('touchmove', (e) => {
                if (!active) return;
                
                e.preventDefault();
                currentX = e.touches[0].clientX - initialX;
                xOffset = currentX;
                
                // Add swipe indicators
                if (currentX < -50) {
                    card.classList.add('swiping-left');
                    card.classList.remove('swiping-right');
                } else if (currentX > 50) {
                    card.classList.add('swiping-right');
                    card.classList.remove('swiping-left');
                } else {
                    card.classList.remove('swiping-left', 'swiping-right');
                }
                
                card.style.transform = `translateX(${currentX}px)`;
            });

            card.addEventListener('touchend', (e) => {
                active = false;
                
                const touchEndX = e.changedTouches[0].clientX;
                const diffX = touchEndX - this.touchStartX;
                
                // Check for swipe actions
                if (Math.abs(diffX) > this.swipeThreshold) {
                    if (diffX < 0) {
                        // Swipe left - Mark as no-show
                        this.handleNoShow(card);
                    } else {
                        // Swipe right - Mark as completed
                        this.handleComplete(card);
                    }
                } else {
                    // Reset position
                    card.style.transform = '';
                    card.classList.remove('swiping-left', 'swiping-right');
                }
                
                xOffset = 0;
            });
        });
    }

    initRealtimeUpdates() {
        if (typeof socket !== 'undefined') {
            socket.on('queue-update', (data) => {
                this.handleRealtimeUpdate(data);
            });

            socket.on('new-customer', (data) => {
                this.addNewCustomerCard(data);
            });

            socket.on('status-change', (data) => {
                this.updateCardFromServer(data);
            });
        }
    }

    initQuickActions() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.quick-action')) {
                const action = e.target.closest('.quick-action');
                const card = action.closest('.queue-card');
                const actionType = action.dataset.action;
                
                switch (actionType) {
                    case 'call':
                        this.handleCall(card);
                        break;
                    case 'message':
                        this.handleMessage(card);
                        break;
                    case 'complete':
                        this.handleComplete(card);
                        break;
                    case 'no-show':
                        this.handleNoShow(card);
                        break;
                }
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.queue-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    createPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder active';
        return placeholder;
    }

    removePlaceholders() {
        document.querySelectorAll('.drag-placeholder').forEach(p => p.remove());
    }

    updateCardStatus(card, column) {
        const columnType = column.dataset.status;
        const statusDot = card.querySelector('.status-dot');
        
        // Remove all status classes
        statusDot.classList.remove('waiting', 'serving', 'completed');
        card.dataset.status = columnType;
        
        // Add new status class
        statusDot.classList.add(columnType);
        
        // Update status text
        const statusText = card.querySelector('.queue-status-indicator span:last-child');
        statusText.textContent = columnType.charAt(0).toUpperCase() + columnType.slice(1);
    }

    animateCardDrop(card) {
        card.classList.add('new');
        setTimeout(() => {
            card.classList.remove('new');
        }, 500);
    }

    sendStatusUpdate(card, column) {
        const queueId = card.dataset.queueId;
        const newStatus = column.dataset.status;
        
        fetch(`/api/queue/update-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                queueId: queueId,
                status: newStatus
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification('Status updated successfully', 'success');
            }
        })
        .catch(error => {
            console.error('Error updating status:', error);
            this.showNotification('Failed to update status', 'error');
        });
    }

    handleCall(card) {
        const queueId = card.dataset.queueId;
        const customerName = card.querySelector('.customer-name').textContent;
        
        // Animate the call action
        card.classList.add('calling');
        
        fetch(`/api/queue/${queueId}/call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification(`Calling ${customerName}...`, 'info');
                // Move to serving column
                this.moveCardToColumn(card, 'serving');
            }
        })
        .catch(error => {
            console.error('Error calling customer:', error);
        })
        .finally(() => {
            setTimeout(() => card.classList.remove('calling'), 1000);
        });
    }

    handleMessage(card) {
        const queueId = card.dataset.queueId;
        const modal = document.getElementById('messageModal');
        
        if (modal) {
            modal.dataset.queueId = queueId;
            modal.classList.add('active');
            document.getElementById('messageModalBackdrop').classList.add('active');
        }
    }

    handleComplete(card) {
        const queueId = card.dataset.queueId;
        
        // Animate completion
        card.style.transform = 'translateX(100%)';
        card.style.opacity = '0';
        
        fetch(`/api/queue/${queueId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                setTimeout(() => {
                    this.moveCardToColumn(card, 'completed');
                    card.style.transform = '';
                    card.style.opacity = '';
                }, 300);
                this.showNotification('Customer served successfully', 'success');
            }
        })
        .catch(error => {
            console.error('Error completing service:', error);
            card.style.transform = '';
            card.style.opacity = '';
        });
    }

    handleNoShow(card) {
        const queueId = card.dataset.queueId;
        
        // Animate no-show
        card.style.transform = 'translateX(-100%)';
        card.style.opacity = '0';
        
        fetch(`/api/queue/${queueId}/no-show`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                setTimeout(() => {
                    card.remove();
                    this.updateQueueCounts();
                }, 300);
                this.showNotification('Marked as no-show', 'warning');
            }
        })
        .catch(error => {
            console.error('Error marking no-show:', error);
            card.style.transform = '';
            card.style.opacity = '';
        });
    }

    moveCardToColumn(card, columnStatus) {
        const targetColumn = document.querySelector(`.queue-column[data-status="${columnStatus}"]`);
        if (targetColumn) {
            const dropZone = targetColumn.querySelector('.queue-items');
            dropZone.appendChild(card);
            this.updateCardStatus(card, targetColumn);
            this.animateCardDrop(card);
            this.updateQueueCounts();
        }
    }

    addNewCustomerCard(customerData) {
        const waitingColumn = document.querySelector('.queue-column[data-status="waiting"] .queue-items');
        
        const cardHtml = this.createCardHtml(customerData);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml;
        const newCard = tempDiv.firstElementChild;
        
        waitingColumn.insertBefore(newCard, waitingColumn.firstChild);
        
        // Re-initialize drag and touch events for new card
        this.initDragAndDropForCard(newCard);
        this.initTouchEventsForCard(newCard);
        
        // Animate entry
        newCard.classList.add('new');
        this.updateQueueCounts();
        
        // Show notification
        this.showNotification(`New customer: ${customerData.name}`, 'info');
    }

    createCardHtml(data) {
        const waitTime = this.calculateWaitTime(data.joinedAt);
        
        return `
            <div class="queue-card" data-queue-id="${data.id}" data-status="${data.status}">
                <div class="quick-actions">
                    <button class="quick-action" data-action="call" title="Call Customer">
                        <i class="bi bi-telephone"></i>
                    </button>
                    <button class="quick-action" data-action="message" title="Send Message">
                        <i class="bi bi-chat-dots"></i>
                    </button>
                </div>
                
                <div class="queue-card-header">
                    <div class="queue-number-badge">${data.queueNumber}</div>
                    <div class="queue-status-indicator">
                        <span class="status-dot ${data.status}"></span>
                        <span>${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span>
                    </div>
                </div>
                
                <div class="customer-info">
                    <div class="customer-name">${data.name}</div>
                    <div class="customer-details">
                        <div class="detail-item">
                            <i class="bi bi-people"></i>
                            <span>${data.partySize} ${data.partySize === 1 ? 'person' : 'people'}</span>
                        </div>
                        <div class="detail-item">
                            <i class="bi bi-phone"></i>
                            <span>${data.phoneNumber}</span>
                        </div>
                    </div>
                </div>
                
                <div class="queue-actions">
                    <button class="action-btn secondary" onclick="queueManager.handleCall(this.closest('.queue-card'))">
                        <i class="bi bi-megaphone"></i>
                        Call
                    </button>
                    <button class="action-btn primary" onclick="queueManager.handleMessage(this.closest('.queue-card'))">
                        <i class="bi bi-send"></i>
                        Notify
                    </button>
                    <button class="action-btn success" onclick="queueManager.handleComplete(this.closest('.queue-card'))">
                        <i class="bi bi-check-circle"></i>
                        Complete
                    </button>
                </div>
                
                <div class="wait-timer">
                    <i class="bi bi-clock timer-icon"></i>
                    <span>${waitTime}</span>
                </div>
                
                <div class="swipe-indicator left">
                    <i class="bi bi-x-circle" style="color: var(--color-error); font-size: 24px;"></i>
                </div>
                <div class="swipe-indicator right">
                    <i class="bi bi-check-circle" style="color: var(--color-success); font-size: 24px;"></i>
                </div>
            </div>
        `;
    }

    calculateWaitTime(joinedAt) {
        const now = new Date();
        const joined = new Date(joinedAt);
        const diffMinutes = Math.floor((now - joined) / 60000);
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes === 1) return '1 min';
        if (diffMinutes < 60) return `${diffMinutes} mins`;
        
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        
        if (hours === 1 && minutes === 0) return '1 hour';
        if (hours === 1) return `1 hour ${minutes} mins`;
        if (minutes === 0) return `${hours} hours`;
        return `${hours} hours ${minutes} mins`;
    }

    updateQueueCounts() {
        const columns = document.querySelectorAll('.queue-column');
        
        columns.forEach(column => {
            const count = column.querySelectorAll('.queue-card').length;
            const countBadge = column.querySelector('.queue-count');
            if (countBadge) {
                countBadge.textContent = count;
                
                // Animate count change
                countBadge.classList.add('updated');
                setTimeout(() => countBadge.classList.remove('updated'), 300);
            }
        });
        
        // Update accessibility labels when counts change
        this.updateAriaLabels();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type} slide-up`;
        notification.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    handleRealtimeUpdate(data) {
        // Handle various real-time updates
        switch (data.type) {
            case 'status-change':
                this.updateCardFromServer(data);
                break;
            case 'new-customer':
                this.addNewCustomerCard(data.customer);
                break;
            case 'customer-removed':
                this.removeCard(data.queueId);
                break;
        }
    }

    updateCardFromServer(data) {
        const card = document.querySelector(`[data-queue-id="${data.queueId}"]`);
        if (card && data.newStatus) {
            this.moveCardToColumn(card, data.newStatus);
        }
    }

    removeCard(queueId) {
        const card = document.querySelector(`[data-queue-id="${queueId}"]`);
        if (card) {
            card.style.transform = 'scale(0)';
            card.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                this.updateQueueCounts();
            }, 300);
        }
    }

    // Initialize drag and drop for a single card
    initDragAndDropForCard(card) {
        card.draggable = true;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-describedby', 'keyboard-instructions');
        
        const customerName = card.querySelector('.customer-name')?.textContent || 'Customer';
        const status = card.dataset.status || 'waiting';
        card.setAttribute('aria-label', `${customerName}, status: ${status}. Press Enter to select for keyboard navigation, or use mouse to drag.`);

        card.addEventListener('dragstart', (e) => {
            this.draggedElement = e.target;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.target.innerHTML);
            this.announce(`Started dragging ${customerName}`);
        });

        card.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
            this.draggedElement = null;
            this.announce(`Finished dragging ${customerName}`);
        });
        
        // Add keyboard listener for new card
        card.addEventListener('keydown', (e) => {
            if (this.handleCardKeyboard(e, card)) {
                e.preventDefault();
            }
        });
    }

    // Initialize touch events for a single card
    initTouchEventsForCard(card) {
        let currentX = 0;
        let initialX = 0;
        let xOffset = 0;
        let active = false;

        card.addEventListener('touchstart', (e) => {
            initialX = e.touches[0].clientX - xOffset;
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            active = true;
        });

        card.addEventListener('touchmove', (e) => {
            if (!active) return;
            
            e.preventDefault();
            currentX = e.touches[0].clientX - initialX;
            xOffset = currentX;
            
            if (currentX < -50) {
                card.classList.add('swiping-left');
                card.classList.remove('swiping-right');
            } else if (currentX > 50) {
                card.classList.add('swiping-right');
                card.classList.remove('swiping-left');
            } else {
                card.classList.remove('swiping-left', 'swiping-right');
            }
            
            card.style.transform = `translateX(${currentX}px)`;
        });

        card.addEventListener('touchend', (e) => {
            active = false;
            
            const touchEndX = e.changedTouches[0].clientX;
            const diffX = touchEndX - this.touchStartX;
            
            if (Math.abs(diffX) > this.swipeThreshold) {
                if (diffX < 0) {
                    this.handleNoShow(card);
                } else {
                    this.handleComplete(card);
                }
            } else {
                card.style.transform = '';
                card.classList.remove('swiping-left', 'swiping-right');
            }
            
            xOffset = 0;
        });
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.queueManager = new QueueDragDropManager();
});

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 16px 24px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        font-size: 14px;
        font-weight: 500;
    }
    
    .notification.success { color: var(--color-success); }
    .notification.error { color: var(--color-error); }
    .notification.warning { color: var(--color-warning); }
    .notification.info { color: var(--color-info); }
    
    .notification.slide-up {
        animation: slideUp 0.3s ease-out;
    }
    
    .notification.fade-out {
        animation: fadeOut 0.3s ease-out forwards;
    }
    
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: translateY(20px);
        }
    }
    
    .queue-count.updated {
        animation: pulse 0.3s ease-out;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
    
    .queue-card.calling {
        animation: shake 0.5s ease-in-out;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);