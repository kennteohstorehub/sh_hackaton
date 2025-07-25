// Queue Performance Module for Dashboard
function initQueuePerformance() {
    fetchQueuePerformance();
    // Refresh every 30 seconds
    setInterval(fetchQueuePerformance, 30000);
}

async function fetchQueuePerformance() {
    try {
        const response = await fetch('/api/queue/performance', {
            credentials: 'same-origin',
            headers: {
                'X-CSRF-Token': window.csrfToken || document.querySelector('meta[name="csrf-token"]')?.content
            }
        });
        
        if (!response.ok) {
            console.error('Failed to fetch queue performance');
            return;
        }
        
        const data = await response.json();
        renderQueuePerformanceCards(data.queues || []);
    } catch (error) {
        console.error('Error fetching queue performance:', error);
    }
}

function renderQueuePerformanceCards(queues) {
    const container = document.getElementById('queuePerformanceCards');
    if (!container) return;
    
    if (!queues || queues.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; background: rgba(255, 255, 255, 0.05); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="width: 80px; height: 80px; margin: 0 auto 1.5rem; 
                            background: linear-gradient(135deg, rgba(255, 140, 0, 0.1), rgba(255, 107, 53, 0.1));
                            border-radius: 50%; display: flex; align-items: center; justify-content: center;
                            border: 2px solid rgba(255, 140, 0, 0.2);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 140, 0, 0.5)" stroke-width="2">
                        <path d="M3 12h18m-9-9v18"/>
                    </svg>
                </div>
                <p style="color: rgba(255, 255, 255, 0.5); font-size: 1.1rem;">No queue data available</p>
                <p style="color: rgba(255, 255, 255, 0.3); font-size: 0.9rem; margin-top: 0.5rem;">
                    Queue performance metrics will appear here once customers start joining
                </p>
            </div>`;
        return;
    }
    
    let html = '<div style="display: grid; gap: 1.5rem;">';
    
    queues.forEach((queue, index) => {
        const efficiency = queue.efficiency || 0;
        
        // Determine gradient and glow based on efficiency
        let gradientColors, glowColor, efficiencyIcon;
        if (efficiency > 80) {
            gradientColors = 'linear-gradient(135deg, #4ade80, #22c55e)';
            glowColor = 'rgba(34, 197, 94, 0.3)';
            efficiencyIcon = '🚀';
        } else if (efficiency > 60) {
            gradientColors = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
            glowColor = 'rgba(245, 158, 11, 0.3)';
            efficiencyIcon = '⚡';
        } else {
            gradientColors = 'linear-gradient(135deg, #f87171, #ef4444)';
            glowColor = 'rgba(239, 68, 68, 0.3)';
            efficiencyIcon = '⚠️';
        }
        
        html += `
            <div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 20px;
                        padding: 2rem;
                        position: relative;
                        overflow: hidden;
                        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        animation: fadeInScale 0.6s ease-out ${index * 0.1}s both;">
                
                <!-- Animated background gradient -->
                <div style="position: absolute; top: -50%; right: -50%; width: 200%; height: 200%;
                            background: radial-gradient(circle, ${glowColor} 0%, transparent 50%);
                            opacity: 0.3; pointer-events: none;
                            animation: rotateGlow 20s linear infinite;"></div>
                
                <!-- Header with queue name and efficiency -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; position: relative;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 50px; height: 50px; 
                                    background: linear-gradient(135deg, rgba(255, 140, 0, 0.2), rgba(255, 107, 53, 0.2));
                                    border-radius: 12px; display: flex; align-items: center; justify-content: center;
                                    border: 1px solid rgba(255, 140, 0, 0.3);
                                    box-shadow: 0 4px 20px rgba(255, 140, 0, 0.2);">
                            <span style="font-size: 1.5rem;">🏪</span>
                        </div>
                        <div>
                            <h4 style="margin: 0; color: #ffffff; font-size: 1.3rem; font-weight: 600;">${queue.name}</h4>
                            <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 0.85rem;">Queue Performance</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${gradientColors}; 
                                    color: white; 
                                    padding: 0.5rem 1rem; 
                                    border-radius: 16px; 
                                    font-size: 1.1rem;
                                    font-weight: 700;
                                    box-shadow: 0 4px 20px ${glowColor};
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 0.5rem;">
                            <span>${efficiencyIcon}</span>
                            <span>${efficiency}%</span>
                        </div>
                        <p style="margin: 0.25rem 0 0 0; color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">Efficiency Rate</p>
                    </div>
                </div>
                
                <!-- Metrics Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
                    <!-- Total Customers -->
                    <div style="background: linear-gradient(135deg, rgba(255, 140, 0, 0.1), rgba(255, 140, 0, 0.05));
                                border: 1px solid rgba(255, 140, 0, 0.2);
                                border-radius: 16px;
                                padding: 1.25rem;
                                text-align: center;
                                transition: all 0.3s ease;
                                position: relative;
                                overflow: hidden;">
                        <div style="position: absolute; top: 0; right: 0; width: 60px; height: 60px;
                                    background: radial-gradient(circle, rgba(255, 140, 0, 0.2), transparent);
                                    border-radius: 50%;
                                    transform: translate(20px, -20px);"></div>
                        <div style="font-weight: 700; 
                                    font-size: 2rem; 
                                    background: linear-gradient(135deg, #ff8c00, #ff6b35);
                                    -webkit-background-clip: text;
                                    -webkit-text-fill-color: transparent;
                                    background-clip: text;
                                    position: relative;">
                            ${queue.totalCustomers || 0}
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); margin-top: 0.25rem;">Total Customers</div>
                    </div>
                    
                    <!-- Completed -->
                    <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
                                border: 1px solid rgba(34, 197, 94, 0.2);
                                border-radius: 16px;
                                padding: 1.25rem;
                                text-align: center;
                                transition: all 0.3s ease;
                                position: relative;
                                overflow: hidden;">
                        <div style="position: absolute; top: 0; right: 0; width: 60px; height: 60px;
                                    background: radial-gradient(circle, rgba(34, 197, 94, 0.2), transparent);
                                    border-radius: 50%;
                                    transform: translate(20px, -20px);"></div>
                        <div style="font-weight: 700; 
                                    font-size: 2rem; 
                                    background: linear-gradient(135deg, #4ade80, #22c55e);
                                    -webkit-background-clip: text;
                                    -webkit-text-fill-color: transparent;
                                    background-clip: text;
                                    position: relative;">
                            ${queue.completedCustomers || 0}
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); margin-top: 0.25rem;">Completed</div>
                    </div>
                    
                    <!-- Average Wait Time -->
                    <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
                                border: 1px solid rgba(59, 130, 246, 0.2);
                                border-radius: 16px;
                                padding: 1.25rem;
                                text-align: center;
                                transition: all 0.3s ease;
                                position: relative;
                                overflow: hidden;">
                        <div style="position: absolute; top: 0; right: 0; width: 60px; height: 60px;
                                    background: radial-gradient(circle, rgba(59, 130, 246, 0.2), transparent);
                                    border-radius: 50%;
                                    transform: translate(20px, -20px);"></div>
                        <div style="font-weight: 700; 
                                    font-size: 2rem; 
                                    background: linear-gradient(135deg, #60a5fa, #3b82f6);
                                    -webkit-background-clip: text;
                                    -webkit-text-fill-color: transparent;
                                    background-clip: text;
                                    position: relative;">
                            ${queue.averageWaitTime || 0}
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); margin-top: 0.25rem;">Avg Wait (min)</div>
                    </div>
                    
                    <!-- Current Length -->
                    <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.05));
                                border: 1px solid rgba(168, 85, 247, 0.2);
                                border-radius: 16px;
                                padding: 1.25rem;
                                text-align: center;
                                transition: all 0.3s ease;
                                position: relative;
                                overflow: hidden;">
                        <div style="position: absolute; top: 0; right: 0; width: 60px; height: 60px;
                                    background: radial-gradient(circle, rgba(168, 85, 247, 0.2), transparent);
                                    border-radius: 50%;
                                    transform: translate(20px, -20px);"></div>
                        <div style="font-weight: 700; 
                                    font-size: 2rem; 
                                    background: linear-gradient(135deg, #c084fc, #a855f7);
                                    -webkit-background-clip: text;
                                    -webkit-text-fill-color: transparent;
                                    background-clip: text;
                                    position: relative;">
                            ${queue.currentLength || 0}
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); margin-top: 0.25rem;">In Queue Now</div>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6);">Service Progress</span>
                        <span style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.8); font-weight: 600;">
                            ${queue.completedCustomers || 0} / ${queue.totalCustomers || 0}
                        </span>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.1); 
                                height: 8px; 
                                border-radius: 4px; 
                                overflow: hidden;
                                position: relative;">
                        <div style="width: ${efficiency}%; 
                                    height: 100%; 
                                    background: ${gradientColors};
                                    border-radius: 4px;
                                    transition: width 1s ease-out;
                                    position: relative;
                                    overflow: hidden;">
                            <div style="position: absolute; 
                                        top: 0; 
                                        left: 0; 
                                        right: 0; 
                                        bottom: 0;
                                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                                        animation: shimmer 2s infinite;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Show the section if it was hidden
    const section = document.querySelector('.queue-performance-section');
    if (section) {
        section.style.display = 'block';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQueuePerformance);
} else {
    initQueuePerformance();
}