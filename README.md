# tidb-contributor
TiDB Contributor List，TiDB 开源项目贡献者名单。

## 说明
通过单列列表的形式显示开源项目的贡献者的完整名单，根据贡献的数量进行排序。
首次加载时会通过 Github API 获取 TiDB 项目的贡献者名单，获取贡献者的用户名、头像链接、首页链接、贡献数等信息，并存放到浏览器的 IndexedDB 当中缓存起来。后续再借助 indexedDB 的索引实现排序、搜索等功能。
下次打开页面时会直接从 IndexedDB 的缓存当中获取数据，缓存当中的数据默认是7天的有效期，过期之后再次打开页面会重新通过 Github API 获取数据。

## TodoList
- [x] 根据贡献数进行排名
- [ ] 根据Github名称进行搜索
- [ ] 显示贡献者提交记录的折线图
