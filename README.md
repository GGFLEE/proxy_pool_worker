# Proxy Pool

挂在cloudflare上的代理池。

## 使用说明

[在线访问](https://proxy-pool.fit2.fun)

### 命令行访问

#### 获取所有地址列表：

`curl  https://proxy-pool.fit2.fun/list`
`wget https://proxy-pool.fit2.fun/list -O  urls.txt`

返回格式：

```
[github]
https://ghp.ci
https://ghproxy.cn
https://gitproxy.mrhjx.cn
https://ghp.keleyaa.com
https://gh.monlor.com
https://gh.xx9527.cn
https://ghproxy.cc
https://ghp.arslantu.xyz
https://firewall.lxstd.org
https://ghproxy.imciel.com
https://fastgit.cc
https://github.limoruirui.com
https://cf.ghproxy.cc
https://ghproxy.xiaopa.cc
https://gh-proxy.llyke.com
https://gh.api.99988866.xyz
https://liqiu.love
https://github.ednovas.xyz
https://gh.zwy.me
https://ghp.p3terx.com
https://gh.6yit.com
https://git.886.be
https://ghproxy.1888866.xyz
https://gh.sixyin.com
https://gh.cache.cloudns.org
https://gitproxy.click
https://git.669966.xyz
https://cdn.moran233.xyz
https://gh-proxy.ygxz.in
https://gh.tryxd.cn
https://mirror.ghproxy.com
https://ghproxy.cianogame.top
https://g.blfrp.cn
https://proxy.yaoyaoling.net

```

#### 获取一个~~速度最快的~~地址：

`curl https://proxy-pool.fit2.fun/github`

## API 说明

| 方法 | 路径          | 说明                    | 参数                                                     |
| ---- | ------------- | ----------------------- | -------------------------------------------------------- |
| GET  | `/json`       | 获取列表列表(JSON 格式) | -                                                        |
| GET  | `/list`       | 获取代理列表(文本格式)  | -                                                        |
| POST | `/add/github` | 添加代理                | `{urls:['https://example1.com','https://example2.com']}` |
| GET  | `/github`     | 返回一个地址            | -                                                        |

## 部署

创建 D1 数据库，并替换`wrangler.toml`中的`database_id`。

```
npm install wrangler
wrangler deploy
```
