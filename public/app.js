// 配置常量
const CONFIG = {
    PROXY_TYPES: {
        github: 'GitHub',
        npm: 'NPM',
        py: 'Py'
    },
    TEST_TIMEOUT: 10000,
    SPEED_THRESHOLDS: {
        SLOW: 1024,    // 1MB/s
        MEDIUM: 2048,  // 2MB/s
        FAST: 5120,    // 5MB/s
        VERY_FAST: 10240, // 10MB/s
        SUPER_FAST: 20480, // 20MB/s
        ULTRA_FAST: 30720  // 30MB/s
    },
    RESPONSE_TIME_THRESHOLDS: {
        EXCELLENT: 100,
        GOOD: 250,
        FAIR: 500,
        SLOW: 1000,
        VERY_SLOW: 2000,
        POOR: 3000
    }
};

// 状态管理
const State = {
    currentType: 'github',
    proxyList: {},
    testing: false,
    testProgress: {
        total: 0,
        completed: 0
    }
};

// UI 组件类
class UIComponents {
    static containers = {
        main: null,
        github: null,
        npm: null,
        py: null
    };

    static initialize() {
        this.containers.main = document.getElementById('main-container');
    }

    static createProxyCard(proxy, showTestResults = false) {
        const card = document.createElement('div');
        card.className = 'proxy-card';
        card.id = `proxy-${proxy.url.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'proxy-card-content';
        
        // URL和复制按钮容器
        const urlContainer = document.createElement('div');
        urlContainer.className = 'flex justify-between items-center mb-3';
        
        // URL链接
        const urlLink = document.createElement('a');
        urlLink.href = proxy.url;
        urlLink.target = '_blank';
        urlLink.className = 'proxy-url font-medium truncate mr-2';
        urlLink.title = proxy.url;
        urlLink.textContent = proxy.url;
        
        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Utils.copyToClipboard(proxy.url);
        });
        
        urlContainer.appendChild(urlLink);
        urlContainer.appendChild(copyBtn);
        
        // 状态信息容器
        const statusContainer = document.createElement('div');
        statusContainer.className = 'mt-2 grid grid-cols-3 gap-2';
        
        // 下载速度显示
        const speedInfo = Utils.formatSpeed(proxy.download_speed);
        const speedText = document.createElement('div');
        speedText.className = `speed-text text-sm ${speedInfo.class} flex items-center justify-center`;
        speedText.innerHTML = `${speedInfo.emoji} ${speedInfo.text}`;
        
        if (showTestResults) {
            // 响应时间显示
            const resTimeInfo = Utils.getResTimeInfo(proxy.ResTime || -1);
            const resTimeText = document.createElement('div');
            resTimeText.className = `ResTime-text text-sm ${resTimeInfo.class} flex items-center justify-center`;
            resTimeText.innerHTML = `${resTimeInfo.emoji} ${resTimeInfo.text}`;
            
            // 状态显示
            const statusText = document.createElement('div');
            if (proxy.status === 1) {
                statusText.className = 'status-text text-sm text-green-500 flex items-center justify-center';
                statusText.innerHTML = '✅ 成功';
            } else if (proxy.status === -1) {
                statusText.className = 'status-text text-sm text-red-500 flex items-center justify-center';
                statusText.innerHTML = '❌ 失败';
            } else {
                statusText.className = 'status-text text-sm text-orange-500 flex items-center justify-center';
                statusText.innerHTML = '⏳ 测试中';
            }
            
            statusContainer.appendChild(resTimeText);
            statusContainer.appendChild(statusText);
        } else {
            // 在初始加载时，只显示下载速度
            statusContainer.className = 'mt-2 flex justify-end';
        }
        
        statusContainer.appendChild(speedText);
        
        contentWrapper.appendChild(urlContainer);
        contentWrapper.appendChild(statusContainer);
        card.appendChild(contentWrapper);
        
        return card;
    }

    static createProxyTypeButtons() {
        const container = document.getElementById('proxy-types');
        Object.entries(CONFIG.PROXY_TYPES).forEach(([type, label]) => {
            const button = this.createTypeButton(type, label);
            container.appendChild(button);
        });
    }

    static createTypeButton(type, label) {
        const isActive = type === State.currentType;
        const button = document.createElement('button');
        button.className = this.getTypeButtonClass(isActive);
        button.innerHTML = this.getTypeButtonContent(label, isActive);
        button.onclick = () => ProxyManager.switchProxyType(type);
        return button;
    }

    static getTypeButtonClass(isActive) {
        return `px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
            isActive 
            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
        } mx-1 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50`;
    }

    static getTypeButtonContent(label, isActive) {
        return `
            <span class="relative inline-flex items-center">
                ${isActive ? '<span class="absolute -left-1 -top-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span>' : ''}
                ${label}
            </span>
        `;
    }
}

// 代理管理类
class ProxyManager {
    static async initialize() {
        UIComponents.initialize();
        UIComponents.createProxyTypeButtons();
        await this.createContainers();
        await this.loadProxies();
        EventManager.initialize();
    }

    static async createContainers() {
        if (!UIComponents.containers.main) return;
        
        Object.keys(CONFIG.PROXY_TYPES).forEach(type => {
            const container = document.createElement('div');
            container.id = `proxy-list-${type}`;
            container.className = `proxy-list-container ${type === State.currentType ? '' : 'hidden'}`;
            container.innerHTML = `
                <div class="proxy-list-wrapper">
                    <div class="grid grid-cols-1 gap-4 p-4"></div>
                </div>
            `;
            UIComponents.containers.main.appendChild(container);
            UIComponents.containers[type] = container;
        });
    }

    static async loadProxies() {
        ProgressBar.show('⏳ 正在加载...');
        try {
            const response = await fetch('/json');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            State.proxyList = Array.isArray(data) ? data : [];
            this.renderProxiesByType();
        } catch (error) {
            console.error('Failed to load proxies:', error);
            Toast.show('加载代理列表失败，请稍后重试', 'error');
        } finally {
            ProgressBar.hide();
        }
    }

    static renderProxiesByType() {
        Object.keys(CONFIG.PROXY_TYPES).forEach(type => {
            const typeProxies = State.proxyList.filter(p => p.proxy_type === type);
            typeProxies.sort((a, b) => (b.download_speed || 0) - (a.download_speed || 0));
            
            const container = document.getElementById(`proxy-list-${type}`);
            const grid = container.querySelector('.grid');
            
            grid.innerHTML = typeProxies.length === 0 
                ? '<div class="col-span-full text-center text-gray-500 py-8">恭喜你发现了新大陆！目前还没有代理地址，快去贡献吧！</div>'
                : '';
            
            typeProxies.forEach(proxy => {
                grid.appendChild(UIComponents.createProxyCard(proxy));
            });
        });
    }

    static switchProxyType(type) {
        if (type === State.currentType) return;
        State.currentType = type;
        this.updateTypeButtons();
        this.showCurrentTypeContainer();
    }

    static updateTypeButtons() {
        document.querySelectorAll('#proxy-types button').forEach(btn => {
            const type = btn.textContent.trim();
            btn.className = UIComponents.getTypeButtonClass(type === CONFIG.PROXY_TYPES[State.currentType]);
        });
    }

    static showCurrentTypeContainer() {
        document.querySelectorAll('.proxy-list-container').forEach(container => {
            container.classList.toggle('hidden', !container.id.endsWith(State.currentType));
        });
    }
}

// 工具类
class Utils {
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Toast.show('复制成功！');
        } catch (error) {
            Toast.show('复制失败，请手动复制。');
        }
    }

    static normalizeUrl(url) {
        try {
            // 去除空格和空行
            url = url.trim().toLowerCase();
            if (!url || url === 'https://' || url === 'http://') {
                return '';
            }
            
            // 如果没有协议，添加 https://
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            // 将 http:// 替换为 https://
            if (url.startsWith('http://')) {
                url = 'https://' + url.slice(7);
            }

            // 解析 URL
            const urlObj = new URL(url);
            
            // 检查主机名是否有效
            if (!urlObj.hostname || urlObj.hostname === 'localhost' || urlObj.hostname.length < 3) {
                return '';
            }
            
            // 处理 www
            let hostname = urlObj.hostname;
            if (hostname.startsWith('www.')) {
                hostname = hostname.slice(4);
            }
            
            // 重建 URL，忽略末尾的斜杠
            const normalizedUrl = `https://${hostname}${urlObj.pathname}${urlObj.search}`.replace(/\/$/, '');
            return normalizedUrl;
        } catch {
            return '';
        }
    }

    static async validateAndCleanUrls(urls) {

        const Urls = urls
            .split('\n')
            .map(url => this.normalizeUrl(url)).filter(url => url !== '');

        // 去重（使用 Set）
        const uniqueUrls= Array.from(new Set(Urls));
        
        // 移除已有代理
  
        uniqueUrls.forEach(url => {
            if (State.proxyList.map(p => p.url).includes(url)) {
                uniqueUrls.splice(uniqueUrls.indexOf(url), 1);
            
            }
        });

        // 验证
        const UploadUrls = [];
        const invalidUrls = [];
        // 过滤掉无效的地址
        
        const promises = uniqueUrls.map(async (url) => {
            try {
                const result = await TestManager.testProxy(url);
                return { url, result };
            } catch (error) {
                console.log(error.message)
                return { url, result: { success: false, error: error.message } };
                
            }
        });
        const results = await Promise.all(promises);
        results.forEach(({ url, result }) => {
            if (!result.success) {
                invalidUrls.push(url);
            } else {
                UploadUrls.push(url);
            }
        });
        return {
            UploadUrls,
            invalidUrls,
            validCount: Urls.length-invalidUrls.length,
        };
    }

    static formatSpeed(speed) {
        if (speed <= 0) {
            return { text: '未知', emoji: '🤷', class: 'text-gray-500' };
        }
        if (speed < CONFIG.SPEED_THRESHOLDS.SLOW) {
            return { 
                text: `${speed.toFixed(1)} KB/s`, 
                emoji: '🐌', 
                class: 'text-red-500'
            };
        }
        if (speed < CONFIG.SPEED_THRESHOLDS.MEDIUM) {
            return { 
                text: `${(speed / 1024).toFixed(2)} MB/s`, 
                emoji: '🚶‍', 
                class: 'text-black-500'
            };
        }
        if (speed < CONFIG.SPEED_THRESHOLDS.FAST) {
            return { 
                text: `${(speed / 1024).toFixed(2)} MB/s`, 
                emoji: '🚴‍', 
                class: 'text-yellow-500'
            };
        }
        if (speed < CONFIG.SPEED_THRESHOLDS.VERY_FAST) {
            return { 
                text: `${(speed / 1024).toFixed(2)} MB/s`, 
                emoji: '🚗', 
                class: 'text-green-500'
            };
        }
        if (speed < CONFIG.SPEED_THRESHOLDS.SUPER_FAST) {
            return { 
                text: `${(speed / 1024).toFixed(2)} MB/s`, 
                emoji: '🚄', 
                class: 'text-blue-500'
            };
        }
        if (speed < CONFIG.SPEED_THRESHOLDS.ULTRA_FAST) {
            return { 
                text: `${(speed / 1024).toFixed(2)} MB/s`, 
                emoji: '🚀', 
                class: 'text-indigo-500'
            };
        }
        return { 
            text: `${(speed / 1024).toFixed(2)} MB/s`, 
            emoji: '⚡', 
            class: 'text-purple-500'
        };
    }

    static getResTimeInfo(ResTime) {
        if (ResTime <= 0) {
            return { text: '-', emoji: '🤷', class: 'text-gray-500' };
        }
        if (ResTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.EXCELLENT) {
            return { text: `${ResTime}ms`, emoji: '⚡', class: 'text-purple-500' };
        }
        if (ResTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.GOOD) {
            return { text: `${ResTime}ms`, emoji: '🚀', class: 'text-indigo-500' };
        }
        if (ResTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.FAIR) {
            return { text: `${ResTime}ms`, emoji: '🚄', class: 'text-blue-500' };
        }
        if (ResTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.SLOW) {
            return { text: `${ResTime}ms`, emoji: '🚗', class: 'text-green-500' };
        }
        if (ResTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.VERY_SLOW) {
            return { text: `${ResTime}ms`, emoji: '🚴', class: 'text-yellow-500' };
        }
        if (ResTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.POOR) {
            return { text: `${ResTime}ms`, emoji: '🚶‍', class: 'text-black-500' };
        }
        return { text: `${ResTime}ms`, emoji: '🐌', class: 'text-red-500' };
    }
}

// Toast 通知类
class Toast {
    static show(message, type = 'info') {
        // 移除已存在的 toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        };
        toast.appendChild(closeBtn);
        
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });
    }
}

// 进度条类
class ProgressBar {
    static show(message) {
        const progressContainer = document.getElementById('progress-container');
        const progressMessage = document.getElementById('progress-message');
        const progressBar = document.getElementById('progress-bar');
        
        if (progressContainer && progressMessage && progressBar) {
            progressMessage.textContent = message;
            progressContainer.style.zIndex = '10';
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '0%';
        }
    }

    static hide() {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.style.zIndex = '-1';
            progressContainer.classList.add('hidden');
        }
    }

    static update(percentage) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.style.transition = 'width 0.3s ease-in-out';
        }
    }
}

// 测试管理类
class TestManager {
    static async testAllProxies() {
        if (State.testing) {
            Toast.show('测试正在进行中，请稍候...', 'warning');
            return;
        }
        State.testing = true;

        const proxies = State.proxyList.filter(p => p.proxy_type === State.currentType);
        if (proxies.length === 0) {
            Toast.show('当前类型没有可测试的代理', 'warning');
            State.testing = false;
            return;
        }

        const container = document.getElementById(`proxy-list-${State.currentType}`);
        const grid = container.querySelector('.grid');
        const cards = Array.from(grid.children);
        
        // 初始化所有卡片为测试中状态
        cards.forEach(card => {
            TestManager.initializeCardTestState(card);
        });
        
        ProgressBar.show('测试中...');
        document.getElementById('test-btn').disabled = true;
        
        try {
            const totalProxies = proxies.length;
            let completedTests = 0;
            
            // 并发测试所有代理
            const promises = proxies.map(async (proxy, index) => {
                const card = cards[index];
                try {
                    const result = await TestManager.testProxy(proxy.url);
                    completedTests++;
                    ProgressBar.update(Math.floor((completedTests / totalProxies) * 100));
                    
                    // 更新卡片状态并重新排序
                    TestManager.updateCardAndSort(card, result);
                    
                    return { proxy, result };
                } catch (error) {
                    completedTests++;
                    ProgressBar.update(Math.floor((completedTests / totalProxies) * 100));
                    
                    // 更新卡片状态为失败并重新排序
                    TestManager.updateCardAndSort(card, { success: false, ResTime: -1 });
                    
                    return { 
                        proxy, 
                        result: { 
                            success: false, 
                            error: error.message 
                        } 
                    };
                }
            });

            const results = await Promise.allSettled(promises);
            const summary = results.reduce((acc, result) => {
                if (result.status === 'fulfilled' && result.value.result.success) {
                    acc.success++;
                } else {
                    acc.failed++;
                }
                return acc;
            }, { success: 0, failed: 0 });

            Toast.show(`测试完成！成功: ${summary.success}, 失败: ${summary.failed}`, 'success');
        } catch (error) {
            Toast.show(`测试过程中出现错误: ${error.message}`, 'error');
        } finally {
            State.testing = false;
            document.getElementById('test-btn').disabled = false;
            ProgressBar.hide();
        }
    }

    static initializeCardTestState(card) {
        const statusContainer = card.querySelector('.mt-2');
        statusContainer.className = 'mt-2 grid grid-cols-3 gap-2';
        
        // 添加响应时间显示
        const resTimeText = document.createElement('div');
        resTimeText.className = 'ResTime-text text-sm text-gray-500 flex items-center justify-center';
        resTimeText.innerHTML = '-';
        
        // 添加状态显示
        const statusText = document.createElement('div');
        statusText.className = 'status-text text-sm text-gray-500 flex items-center justify-center';
        statusText.innerHTML = '⏳ 测试中';
        
        // 保持现有的速度显示
        const speedText = statusContainer.lastChild;
        statusContainer.innerHTML = '';
        statusContainer.appendChild(resTimeText);
        statusContainer.appendChild(statusText);
        statusContainer.appendChild(speedText);
    }

    static updateCardAndSort(card, result) {
        const grid = card.parentElement;
        if (!grid) return;

        // 更新卡片状态
        const resTimeText = card.querySelector('.ResTime-text');
        const statusText = card.querySelector('.status-text');
        
        if (result.success) {
            const resTimeInfo = Utils.getResTimeInfo(result.ResTime);
            resTimeText.className = `ResTime-text text-sm ${resTimeInfo.class} flex items-center justify-center`;
            resTimeText.innerHTML = `${resTimeInfo.emoji} ${resTimeInfo.text}`;
            statusText.className = 'status-text text-sm text-green-500 flex items-center justify-center';
            statusText.innerHTML = '✅ 成功';
            card.dataset.resTime = result.ResTime;
        } else {
            const resTimeInfo = Utils.getResTimeInfo(-1);
            resTimeText.className = `ResTime-text text-sm ${resTimeInfo.class} flex items-center justify-center`;
            resTimeText.innerHTML = `${resTimeInfo.emoji} ${resTimeInfo.text}`;
            statusText.className = 'status-text text-sm text-red-500 flex items-center justify-center';
            statusText.innerHTML = '❌ 失败';
            card.dataset.resTime = Infinity;
        }

        // 从当前位置移除
        grid.removeChild(card);

        // 使用二分查找找到正确的插入位置
        const insertPosition = TestManager.findInsertPosition(grid, parseInt(card.dataset.resTime) || Infinity);
        
        // 在正确位置插入卡片
        if (insertPosition >= grid.children.length) {
            grid.appendChild(card);
        } else {
            grid.insertBefore(card, grid.children[insertPosition]);
        }
    }

    static findInsertPosition(container, resTime) {
        const cards = Array.from(container.children);
        let left = 0;
        let right = cards.length - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midCard = cards[mid];
            const midResTime = parseInt(midCard.dataset.resTime) || Infinity;

            if (midResTime === resTime) {
                return mid;
            } else if (midResTime > resTime) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        return left;
    }

    static async testProxy(url) {
        // 先规范化 URL
        url = Utils.normalizeUrl(url);
        if (!url) {
            return {
                success: false,
                error: '无效的URL格式'
            };
        }

        console.log(`[testProxy] 开始测试代理: ${url}`);
        try {
            const startTime = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, CONFIG.TEST_TIMEOUT);

            try {
                // 使用 no-cors 模式，种模式下响应类型为 'opaque'
                const response = await fetch(url, { 
                    method: 'GET',
                    signal: controller.signal,
                    mode: 'no-cors',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                clearTimeout(timeoutId);
                const endTime = Date.now();
                const ResTime = endTime - startTime;

                // 在 no-cors 模式下，如果能获得响应（即使是 opaque），说明代理是可用的
                return {
                    success: true,
                    ResTime: ResTime
                };
            } catch (error) {
                clearTimeout(timeoutId);
                return {
                    success: false,
                    ResTime: -1,
                };
            }
        } catch (error) {
            return {
                success: false,
                ResTime: 0,
            };
        }
    }
}

// 事件管理类
class EventManager {
    static initialize() {
        this.initializeModals();
        this.initializeButtons();
        this.initializeTypeSelect();
    }

    static initializeModals() {
        const contributeModal = document.getElementById('contribute-modal');
        const aboutModal = document.getElementById('about-modal');
        
        // 打开模态框时添加 modal-open 类
        const openModal = (modal) => {
            document.body.classList.add('modal-open');
            modal.classList.remove('hidden');
        };
        
        // 关闭模态框时移除 modal-open 类
        const closeModal = (modal) => {
            document.body.classList.remove('modal-open');
            modal.classList.add('hidden');
        };

        // 模态框事件监听
        document.getElementById('contribute-btn')?.addEventListener('click', () => openModal(contributeModal));
        document.getElementById('about-btn')?.addEventListener('click', () => openModal(aboutModal));
        document.getElementById('modal-cancel')?.addEventListener('click', () => closeModal(contributeModal));
        document.getElementById('about-modal-close')?.addEventListener('click', () => closeModal(aboutModal));

        // 点击模态框外部关闭
        window.addEventListener('click', (event) => {
            if (event.target === contributeModal) closeModal(contributeModal);
            if (event.target === aboutModal) closeModal(aboutModal);
        });

        // 阻止模态框内部点击事件冒泡
        document.querySelectorAll('.modal-content').forEach(content => {
            content?.addEventListener('click', (event) => event.stopPropagation());
        });

        // ESC 键关闭模态框
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (!contributeModal.classList.contains('hidden')) closeModal(contributeModal);
                if (!aboutModal.classList.contains('hidden')) closeModal(aboutModal);
            }
        });

        // 提交按钮点击处理
        document.getElementById('modal-submit')?.addEventListener('click', async () => {
            const urlsInput = document.getElementById('upload-urls');
            const typeSelect = document.getElementById('upload-type-select');
            const submitBtn = document.getElementById('modal-submit');

            if (!urlsInput.value.trim()) {
                Toast.show('请输入至少一个地址', 'error');
                return;
            }

            // 验证和清理 URLs
            const  { UploadUrls, invalidUrls,validCount} = await Utils.validateAndCleanUrls(urlsInput.value);



            if (UploadUrls.length === 0) {
                Toast.show(`成功上传 ${validCount} 个地址，发现 ${invalidUrls.length} 个无效地址，请重新检查`, 'error');
                urlsInput.value = invalidUrls.join('\n');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';

            try {
                const response = await fetch(`/add/${typeSelect.value}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls: UploadUrls })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                let message = `成功提交 ${validCount} 个地址.`;
                if (invalidUrls.length > 0) {
                    message=message+`发现 ${invalidUrls.length} 个无效地址，请重新检查.`;
                    urlsInput.value = invalidUrls.join('\n');
                    Toast.show(message, 'error');
                } else {
                    Toast.show(message, 'success');
                    closeModal(contributeModal);
                    urlsInput.value = '';
                }
                
                
                

            } catch (error) {
                Toast.show(`提交失败: ${error.message}`, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '提交';
            }
        });
    }

    static initializeButtons() {
        // 测试按钮
        document.getElementById('test-btn')?.addEventListener('click', TestManager.testAllProxies);
    }

    static initializeTypeSelect() {
        // 初始化代理类型选择器
        const typeSelect = document.getElementById('upload-type-select');
        if (typeSelect) {
            Object.entries(CONFIG.PROXY_TYPES).forEach(([value, label]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                typeSelect.appendChild(option);
            });
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => ProxyManager.initialize()); 