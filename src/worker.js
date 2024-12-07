const proxy_types = {
  "github": ["https://github.com/GGFLEE/EasySpider//releases/download/2/VisualStudioSetup.exe",4236],// 文件大小单位KB
  "npm": ["react/-/react-18.2.0.tgz",80],
  "pypi": ["downloadurl",0]//暂时空KB
};


async function testDownloadSpeed(url, type) {
  try {
    if (!proxy_types[type]) {
      throw new Error('不支持的代理类型');
    }
    console.log(`proxy_types[type][1]:${proxy_types[type][1]}`)
    const minSize = proxy_types[type][1] * 1024; 
    console.log(`minSize:${minSize}`)
    const startTime = Date.now();
    let testUrl = `${url}/${proxy_types[type][0]}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 获取响应体的大小
      const reader = response.body.getReader();
      let totalBytes = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        
        // 如果已经达到最小大小要求，可以提前结束
        if (totalBytes >= minSize) {
          break;
        }
      }

      clearTimeout(timeout);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 如果下载的内容太小，可能是被重定向或者出现其他问题
      if (totalBytes < minSize) {
        return {
          status: -1,
          download_speed: 0,
          error: '下载内容大小异常'
        };
      }

      // 计算速度（KB/s）
      const speedKBps = Math.round((totalBytes / 1024) / (duration / 1000));

      // 根据不同类型设置不同的速度阈值
      const speedThreshold = 50; // 统一设置为 50KB/s

      return {
        status: speedKBps >= speedThreshold ? 1 : 0,
        download_speed: speedKBps,
        error: null
      };

    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        return {
          status: -1,
          download_speed: 0,
          error: '请求超时'
        };
      }
      throw error;
    }

  } catch (error) {
    return {
      status: -1,
      download_speed: 0,
      error: error.message
    };
  }
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 处理前端静态文件
  if (path === '/') {
    if (!env.ASSETS) {
      return new Response('ASSETS binding not found', { status: 500 });
    }
    return env.ASSETS.fetch(request);
  }

  // 返回代理池JSON
  if (path === '/json') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM proxies ORDER BY proxy_type, download_speed DESC'
    ).all();
    return new Response(JSON.stringify(results || []), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 添加新代理
  if (path.startsWith('/add/')) {
    try {
      const type = path.split('/')[2];
      if (!proxy_types[type]) {
        return new Response('Invalid proxy type', { status: 400 });
      }

      const { urls } = await request.json();
      if (!Array.isArray(urls)) {
        return new Response('Invalid request body', { status: 400 });
      }

      const results = [];
      for (const url of urls) {
        try {
          const test = await testDownloadSpeed(url, type);
          if (test.status >= 0) {
            await env.DB.prepare(
              'INSERT INTO proxies (url, proxy_type, status, download_speed, last_available_time) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
            ).bind(url, type, test.status, test.download_speed).run();
          }
        } catch (error) {
          results.push({ 
            url, 
            success: false, 
            reason: error.message || 'Unknown error'
          });
        }
      }

      return new Response(JSON.stringify(results), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  // 返回特定类型的最快代理
  if (Object.keys(proxy_types).includes(path.slice(1))) {
    const type = path.slice(1);
    const { results } = await env.DB.prepare(
      'SELECT * FROM proxies WHERE proxy_type = ? AND status >= 0 ORDER BY download_speed DESC LIMIT 1'
    ).bind(type).all();
    return new Response(results[0].url, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
  
  if (path === '/list') {
    try {
      // 执行数据库查询，获取所有代理记录
      const { results } = await env.DB.prepare(
        'SELECT * FROM proxies ORDER BY proxy_type, download_speed DESC'
      ).all();

      // 遍历 proxy_types 的所有类型
      const urls = Object.keys(proxy_types).map(type => {
        // 过滤出当前类型的代理
        const filteredProxies = results.filter(proxy => proxy.proxy_type === type);
        
        // 提取代理的 URL 并用换行符连接
        const proxyUrls = filteredProxies.map(proxy => proxy.url).join('\n');
        
        // 如果有代理，则返回格式化字符串
        return proxyUrls ? `[${type}]\n${proxyUrls}` : '';
      });

      // 将所有类型的代理 URL 用两个换行符分隔并返回纯文本响应
      return new Response(urls.join('\n\n'), {
        headers: { 
          'Content-Type': 'text/plain; charset=utf-8' 
        }
      });

    } catch (error) {
      console.error('处理 /list 路径时出错:', error);
      return new Response(error.message);
    }
  }

  return new Response('Not Found', { status: 404 });
}

// 处理定时任务
async function handleScheduled(event, env) {
  const { results: proxies } = await env.DB.prepare('SELECT * FROM proxies').all();
  const nowDate = new Date();
  
  for (const proxy of proxies) {
    const lastDate = proxy.last_available_time ? new Date(proxy.last_available_time) : new Date(0);
    const thirtyDaysAgo = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(nowDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const test = await testDownloadSpeed(proxy.url, proxy.proxy_type);
    
    if ((proxy.status === -1 && lastDate < thirtyDaysAgo) || 
        (proxy.status === 0 && lastDate < sixtyDaysAgo)) {
      await env.DB.prepare('DELETE FROM proxies WHERE id = ?')
        .bind(proxy.id)
        .run();
    } else if ((proxy.status === -1 && lastDate >= thirtyDaysAgo) || 
               (proxy.status === 0 && lastDate >= sixtyDaysAgo)) {
      await env.DB.prepare(
        'UPDATE proxies SET status = ?, download_speed = ?, last_available_time = ? WHERE id = ?'
      ).bind(test.status, test.download_speed, proxy.last_available_time, proxy.id).run();
    } else {
      await env.DB.prepare(
        'UPDATE proxies SET status = ?, download_speed = ?, last_available_time = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(test.status, test.download_speed, proxy.id).run();
    }
  }
}

export default {
  fetch: async (request, env) => handleRequest(request, env),
  scheduled: async (event, env, ctx) => ctx.waitUntil(handleScheduled(event, env))
};