let DBOpenRequest = window.indexedDB.open('contributor', 3);
let db = null;
let searchInput = document.querySelector('#search-input');
let loading = document.querySelector('#loading');

// 打开数据库请求失败事件
DBOpenRequest.onerror = function(event) {
    console.error('Error loading database.');
}

// 打开数据库请求成功事件
DBOpenRequest.onsuccess = function(event) {
    db = DBOpenRequest.result;

    console.log('Database initialised.');

    let loadFinished = localStorage.getItem('LOAD_FINISHED');
    let loadTime = localStorage.getItem('LOAD_TIME');
    let expire = (Date.now() - Number(loadTime)) > 7 * 24 * 3600 * 1000;
    
    if (!loadFinished || (loadFinished && expire) ) {
        localStorage.removeItem('LOAD_FINISHED');
        localStorage.removeItem('LOAD_TIME');

        loadAllContributerList(() => {
            localStorage.setItem('LOAD_FINISHED', true);
            localStorage.setItem('LOAD_TIME', Date.now());

            loadContributerPage().then(({ resultSet, pageIndex, pageSize}) => {
                renderContributerPage(resultSet, pageIndex, pageSize);
            });
        });
    } else {
        loadContributerPage().then(({ resultSet, pageIndex, pageSize}) => {
            renderContributerPage(resultSet, pageIndex, pageSize);
        });
    }
}

// 数据库升级事件（指定的版本号与大于实际版本号时触发）
DBOpenRequest.onupgradeneeded = function(event) {
    db = event.target.result;

    db.onerror = function(error) {
        console.error(error);
    };

    if (!db.objectStoreNames.contains('contributor')) {
        let objectStore = db.createObjectStore('contributor', {
            keyPath: 'login'
        });
        objectStore.createIndex("contributions", "contributions", { unique: false });
    }

    console.log('Object Store Created.');
}

// 更新或插入记录
function dbPutRecord(contributer) {
    let objectStore = db.transaction(['contributor'], 'readwrite').objectStore('contributor');
    let putRequest = objectStore.put(contributer);
    
    return new Promise((resolve, reject) => {
        putRequest.onsuccess = function(event) {
            resolve(event);
        }

        putRequest.onerror = function(event) {
            reject(event);
        }
    });
}

// 添加记录
function dbAddRecord(contributer) {
    let objectStore = db.transaction(['contributor'], 'readwrite').objectStore('contributor');
    let addRequest = objectStore.add(contributer);

    return new Promise((resolve, reject) => {
        addRequest.onsuccess = function(event) {
            resolve(event);
        }

        addRequest.onerror = function(event) {
            reject(event);
        }
    });
}

// 通关 Github API 接口加载所有贡献者的名单
function loadAllContributerList(callback, page) {
    let pageSize = 100;

    if (!page) {
        page = 1;
    }

    console.log('加载贡献者名单 API 被调用了一次');

    // 发送请求
    fetch(`https://api.github.com/repos/pingcap/tidb/contributors?per_page=${ pageSize }&page=${ page }&ann=1`).then((res) => {
        return res.json();
    }).then((res) => {
        let contributors = res;

        for (const contributer of contributors) {
            dbPutRecord(contributer);
        }

        if (contributors && Array.isArray(contributors) && contributors.length === pageSize) {
            loadAllContributerList(callback, page + 1);
        } else {
            console.log("贡献者名单全部加载完毕");
            callback();
        }
    });
}

// 从浏览器数据库当中加载部分贡献者名单
function loadContributerPage(pageIndex, pageSize) {
    loading.classList.remove('hidden');

    var objectStore = db.transaction('contributor').objectStore('contributor');
    var index = objectStore.index('contributions');

    if (!pageIndex) pageIndex = 1;
    if (!pageSize) pageSize = 20;
    let offset = (pageIndex - 1) * pageSize;

    console.log(pageIndex);

    return new Promise((resolve, reject) => {
        let count = 0;
        let resultSet = [];

        // 通过索引实现根据贡献数排序
        index.openCursor(IDBKeyRange.upperBound('contributions', true), "prev").onsuccess = function (event) {
            var cursor = event.target.result;

            if (cursor && offset) {
                cursor.advance(offset);
                offset = 0;
                return;
            }

            if (cursor) {
                resultSet.push(cursor.value);

                if (count + 1 < pageSize) {
                    cursor.continue();    
                } else {
                    // 当前页数据已满，返回结果集
                    resolve({
                        resultSet,
                        pageIndex,
                        pageSize
                    });
                }
                
                count++;
            } else {
                // 没有更多数据，返回结果集
                resolve({
                    resultSet,
                    pageIndex,
                    pageSize
                });
            }
        };
    });
}

// 渲染贡献者名单
function renderContributerPage(list, pageIndex, pageSize) {
    let elTBody = document.getElementById('contributor-table-body');
    
    if (!list || !Array.isArray(list)) return;

    for (let i = 0; i < list.length; i++) {
        let item = list[i];
        let elTRow = document.createElement('div');
        let rowNum = (pageIndex - 1) * pageSize + i + 1;

        elTRow.className = 'table-row';
        elTRow.innerHTML = `
            <div class="table-data contributor-rank-col">
                <span class="contributor-number">${ rowNum }</span>
            </div>
            <div class="table-data contributor-info-col">
                <div class="contributor-info">
                    <img class="contributor-avatar" src="${ item.avatar_url }"/>
                    <a class="contributor-username" target="_blank" href="${ item.html_url }">${ item.login }</a>
                </div>
            </div>
            <div class="table-data contributor-trend-col hidden-xs">
                <div class="contributor-contribute-trend">
                    折线图
                </div>
            </div>
            <div class="table-data contributor-contribution-col">
                <span class="contributor-contributions">${ item.contributions }</span>
            </div>
        `;

        elTBody.appendChild(elTRow);
    }

    loading.classList.add('hidden');
}

// 事件监听
(function() {
    // 触底事件
    let lastScrollTop = 0;
    window.onscroll = function(e) {
        checkScrollToBottom();
    }

    // 移动端触底事件
    window.ontouchend = function(e) {
        console.log(2333);
        checkScrollToBottom();
    }

    // 检查是否触底
    function checkScrollToBottom() {
        let marginBottom = 0;

        if (document.documentElement.scrollTop){
            let X = document.documentElement.scrollHeight;
            let Y = document.documentElement.scrollTop + document.body.scrollTop;
            let Z = document.documentElement.clientHeight;
            marginBottom = X - Y - Z;
        } else {
            let X = document.body.scrollHeight;
            let Y = document.body.scrollTop;
            let Z = document.body.clientHeight;
            marginBottom = X - Y - Z;
        }

        if(marginBottom <= 100 && lastScrollTop < document.documentElement.scrollTop) {
            let event = document.createEvent('HTMLEvents');
            event.initEvent('scrollToBottom', false, false);
            window.dispatchEvent(event);
        }

        lastScrollTop = document.documentElement.scrollTop;
    }
    
    // 触底加载更多
    let pageIndex = 1;
    window.addEventListener('scrollToBottom', function(e) {
        pageIndex = pageIndex + 1;

        if (!db) return; 
        
        loadContributerPage(pageIndex).then(({ resultSet, pageIndex, pageSize}) => {
            renderContributerPage(resultSet, pageIndex, pageSize);
        });
    });

    // 关键词搜索
    searchInput.addEventListener('keydown', function(e) {
        if (e.keyCode === 13) {
            console.log(this.value);
        }
    })
})();