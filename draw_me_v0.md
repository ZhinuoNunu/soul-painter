# 🎨 “灵魂画友”——免费优先技术方案 v0.1

> **文档目的**：这是首发版本的架构与上线约束，不是对某个云服务长期价格、额度或功能的保证。项目坚持**零付费、免费优先**：不主动启用付费资源、不把升级付费套餐作为默认兜底；免费能力不足时，按本文定义的规则受控降级，而不是自动产生费用。

## 0. 目标、范围与免费边界

### 0.1 首发目标

“灵魂画友”允许用户：

1. 创作一张画作；
2. 生成公开分享页；
3. 为自己的画作抽取一次装饰；
4. 在允许互动的公开作品上提交涂鸦；
5. 通过邀请链接完成归因。

### 0.2 非目标

首发不承诺无限保存、实时协作、复杂社交关系、账号找回、付费功能、商业 SLA 或无限容量。动态 OG 图、涂鸦公开展示和复杂邀请排行榜均为可关闭的增强能力，不能阻塞作品创建与只读分享。

### 0.3 免费优先原则（不可改变）

- 用户不需要付费；部署不依赖付费套餐或自动升级。
- 只能在当前账号、地区及目标使用方式均允许的免费能力内上线。
- 不能把“免费计划”写成永久不变的事实；平台价格、资格、地域、账单和限额可能变化。
- 临近免费资源阈值时，先降低写入能力和非核心功能，最后保留已发布作品的只读访问。
- 若关键能力无法在免费条件下验证可用，应改用经验证的免费替代方案，或关闭对应功能；**不得以付费升级作为默认方案**。

---

## 1. 上线前免费可行性核验

在确定供应商、SDK 或 CLI 命令前，维护一份核验记录。每次准备正式发布、变更套餐或关键用量增长时重新检查。

| 能力 | 首选方向 | 必须核验 | 通过条件 | 无免费可用能力时的处理 |
| :-- | :-- | :-- | :-- | :-- |
| 静态页面/CDN | Vercel 或同等免费静态托管 | Hobby/免费计划的用途资格、带宽、地域与超额行为 | 能部署公开只读站点，且不会自动收费 | 仅保留静态落地页，暂停发布 |
| API 运行时 | 与前端一致的平台函数 | 免费额度、单次请求/执行限制、冷启动、超额行为 | 支撑受限写操作与身份校验 | 暂停所有写操作，保留只读页 |
| 关系数据库 | 支持事务的免费 PostgreSQL 兼容数据库 | 免费存储、连接数、休眠、备份/导出、地域 | 支持一次抽奖的单事务 | 不上线抽奖、涂鸦和邀请写入 |
| 对象存储 | 免费对象存储/平台 Blob | 存储、读取、出网、对象数、删除、公开/签名 URL | 有可预期的上传与读取边界 | 限制为临时创作预览，不允许发布新作品 |
| 缓存/限流 | 可选 KV 或数据库慢路径 | 免费操作数、持久性、原子能力 | 仅做限流/缓存，故障不破坏业务一致性 | 改用数据库限流或暂停匿名写入 |
| OG 图片 | 缓存的动态图片或静态回退 | 图片运行时、数据库访问兼容性、缓存 | 不影响核心分享页 | 返回静态默认预览图 |

核验记录至少包含：官方来源链接、核验日期、账号与地区、免费限制、是否需要支付方式、超额行为、首发阈值及降级动作。不得使用“无限”“永久免费”“必定支撑数万用户”等不可验证表述。

> Vercel 的当前套餐和服务限制应以发布当日的官方页面为准，例如 [Hobby 计划说明](https://vercel.com/docs/plans/hobby) 与 [Vercel 定价页](https://vercel.com/pricing)。本方案不在文档中固化会变化的额度数字。

---

## 2. 统一架构：Next.js App Router + 可替换免费服务

首发统一采用 **Next.js App Router**。页面、API 和 OG 路由都遵循同一套目录与运行时规则；不混用静态 HTML、旧式 Vercel Functions、`vercel.json` 手工路由和不同框架的动态参数写法。

```text
浏览器
  ├─ 创作画布、客户端压缩、匿名会话 Cookie
  ├─ 公开只读页面：/p/[publicId]、/invite/[publicId]
  └─ 受保护写入：/api/*
          │
          ▼
Next.js 应用（默认 Node.js runtime）
  ├─ 参数/Origin/会话/配额校验
  ├─ 数据库事务：抽奖、库存、邀请、元数据
  ├─ 受限上传会话与受控读取
  └─ 可选：缓存、限流、OG 图
          │
          ├─ 关系数据库（唯一业务真相）
          ├─ 对象存储（画作与图层）
          └─ 可选 KV（限流与只读缓存，不存权威库存）
```

### 2.1 职责边界

- **关系数据库**：作品元数据、匿名主体、抽奖资格、库存、抽奖记录、涂鸦、邀请关系及审计字段的唯一真相。
- **对象存储**：私有编辑原图、公开分享衍生图、涂鸦图层、预置静态资源。对象存储不承担授权判断。
- **KV/缓存（可选）**：IP/会话限流、短期读缓存、临时去重。即使 KV 不可用，也不能让库存错误或允许重复抽奖。
- **Node runtime**：涉及数据库事务、服务端密钥、上传校验的路由默认使用 Node runtime。
- **Edge runtime（可选）**：仅用于已经验证依赖兼容的 OG/轻量只读路由；不能为了“更快”而牺牲数据库或安全兼容性。

### 2.2 URL 契约

| 路径 | 用途 | 访问方式 |
| :-- | :-- | :-- |
| `/` | 首页/创作入口 | 公开 |
| `/create` | 创作页 | 公开；创建后建立匿名会话 |
| `/p/[publicId]` | 公开作品分享页 | 公开只读 |
| `/invite/[publicId]` | 邀请落地页 | 公开读取；只在有效激活后记录归因 |
| `/api/works` | 建立作品与上传会话 | 受会话、配额和 Origin 保护 |
| `/api/works/[publicId]` | 获取公开作品元数据 | 公开只读、限速 |
| `/api/draw` | 一次性抽装饰 | 仅作品所有者会话、幂等 |
| `/api/scribbles` | 提交/查询涂鸦 | 写入受会话与规则保护；读取仅公开可见内容 |
| `/api/og/[publicId]` | 预览图 | 公开、强缓存、可静态回退 |

分享 URL 中的 `publicId` **不是**写权限。所有编辑、抽奖、删除或管理动作都需服务端验证匿名会话凭据。

---

## 3. 产品规则、身份与状态

### 3.1 匿名身份模型

创建作品时服务端生成两类标识：

- `public_id`：随机、不可递增的公开标识，仅用于分享和只读查询；
- `owner_session`：通过 `HttpOnly`、`Secure`、适当 `SameSite` 的 Cookie 保存的不可预测会话凭据，用于所有者写操作。

可选恢复令牌只能在创建成功后向用户展示一次；它不能放进公开分享 URL。服务端保存恢复令牌的哈希而不是明文。

### 3.2 关键流程规则

| 流程 | 前置条件 | 幂等/结果 | 免费保护 |
| :-- | :-- | :-- | :-- |
| 创建作品 | 会话/来源校验、未进入只读模式 | 同一创建键重试返回同一作品或安全失败 | 尺寸、次数、日配额 |
| 发布分享 | 所有者会话、作品已完成上传 | 重试不创建新对象 | 公开仅限分享衍生图 |
| 抽装饰 | 所有者会话、作品可抽取、幂等键 | 每作品仅一次；重试返回原结果 | 数据库事务、会话限流 |
| 提交涂鸦 | 目标作品公开且开启互动 | 同一提交键只创建一条 | 目标/来源/时间窗限额 |
| 飞镖结算 | 涂鸦已存在且结果未结算 | 只能结算一次 | 由服务端计算，不信任客户端结果 |
| 邀请归因 | 来自有效邀请页且完成首次有效操作 | 同一受邀作品只能归因一次 | 防自邀、唯一约束、反刷阈值 |
| 删除/举报 | 所有者会话或管理流程 | 删除标记可重复执行 | 关闭互动、隐藏公开资源、后续清理 |

涂鸦默认应允许作品所有者关闭互动。若首发无法提供基础举报、删除与限流能力，应将涂鸦限定为受邀测试功能，避免开放匿名公共写入。

---

## 4. 数据模型与一致性

以下为逻辑模型。具体数据库服务在通过免费可行性核验后再确定连接方式和迁移工具。

```sql
CREATE TABLE works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  owner_session_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploading', 'ready', 'deleted', 'failed')),
  original_object_key TEXT,
  share_image_object_key TEXT,
  allow_scribbles BOOLEAN NOT NULL DEFAULT TRUE,
  current_deco_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shared_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE decorations (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rarity SMALLINT NOT NULL CHECK (rarity IN (1, 2, 3)),
  image_object_key TEXT NOT NULL,
  remaining_stock INTEGER,
  is_drawable BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (remaining_stock IS NULL OR remaining_stock >= 0)
);

CREATE TABLE draws (
  id BIGSERIAL PRIMARY KEY,
  work_id UUID NOT NULL UNIQUE REFERENCES works(id),
  deco_id BIGINT NOT NULL REFERENCES decorations(id),
  idempotency_key TEXT NOT NULL,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, idempotency_key)
);

ALTER TABLE works
  ADD CONSTRAINT works_current_deco_fk
  FOREIGN KEY (current_deco_id) REFERENCES decorations(id);

CREATE TABLE scribbles (
  id BIGSERIAL PRIMARY KEY,
  target_work_id UUID NOT NULL REFERENCES works(id),
  source_subject_hash TEXT NOT NULL,
  object_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'visible', 'hidden', 'deleted')),
  dart_result TEXT CHECK (dart_result IN ('target', 'source')),
  resolved_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_work_id, source_subject_hash, idempotency_key)
);

CREATE TABLE invites (
  id BIGSERIAL PRIMARY KEY,
  inviter_work_id UUID NOT NULL REFERENCES works(id),
  invitee_work_id UUID NOT NULL UNIQUE REFERENCES works(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (inviter_work_id <> invitee_work_id)
);

CREATE INDEX works_public_ready_idx ON works (public_id) WHERE status = 'ready';
CREATE INDEX scribbles_visible_target_idx ON scribbles (target_work_id, created_at)
  WHERE status = 'visible';
CREATE INDEX decorations_drawable_idx ON decorations (rarity, id)
  WHERE is_drawable = TRUE;
```

### 4.1 数据生命周期

- `works.status = 'uploading'` 表示已创建上传意图、尚未绑定有效图像；超时后可清理。
- 公开分享只查询 `status = 'ready'` 且未删除的作品。
- 删除作品先撤销公开展示与互动，再异步清理关联对象；清理失败不能恢复公开访问。
- 对象键使用随机 UUID/版本号，不以用户 ID 或连续数字推导。

---

## 5. 一次抽装饰：单事务、可重试

### 5.1 规则

- 每个作品只能抽一次；`draws.work_id UNIQUE` 是最终并发保护。
- 稀有/普通/基础概率、库存粒度和耗尽后的降级顺序必须写入配置并可测试。
- `remaining_stock IS NULL` 表示无限/基础装饰；有限库存由数据库条件更新扣减。
- KV 不参与权威库存。它可以缓存“剩余数量”或限制请求频率。

### 5.2 事务伪代码

```ts
// app/api/draw/route.ts（逻辑示例，默认 Node.js runtime）
// 输入：作品 publicId、幂等键；所有者身份来自 HttpOnly Cookie。

BEGIN;

-- 1. 锁定目标作品并验证会话归属与可抽取状态。
SELECT id, current_deco_id
FROM works
WHERE public_id = $1 AND owner_session_hash = $2 AND status = 'ready'
FOR UPDATE;

-- 2. 已抽过时返回已有记录（幂等重试），不再次扣库存。
SELECT deco_id FROM draws WHERE work_id = $work_id;

-- 3. 按规则选择候选稀有度；仅从可抽取候选中选择。
-- 具体选择策略应避免大表 ORDER BY RANDOM()。
-- 小型装饰池可由代码配置决定候选；有限库存必须在下面条件更新中确认。

-- 4. 对有限库存执行条件扣减；无可用稀有装饰则按固定顺序降级。
UPDATE decorations
SET remaining_stock = remaining_stock - 1
WHERE id = $candidate_id
  AND is_drawable = TRUE
  AND remaining_stock > 0
RETURNING id;

-- 5. 写入唯一抽奖记录和当前装饰；两者同一事务提交。
INSERT INTO draws (work_id, deco_id, idempotency_key)
VALUES ($work_id, $deco_id, $idempotency_key);

UPDATE works SET current_deco_id = $deco_id WHERE id = $work_id;

COMMIT;
```

实现时必须处理唯一冲突和条件更新失败：重新读取已有抽奖结果或按预定义规则降级；不能在数据库之外先扣库存、再依赖补偿。并发测试应证明同一作品的多请求只产生一条 `draws` 记录，且库存永不小于零。

---

## 6. 上传、媒体访问与删除

### 6.1 上传会话流程

不以 Base64 JSON 作为默认上传接口。Base64 会增加请求体积和函数内存压力，且难以设置可靠边界。

1. 客户端请求创建上传会话，服务端验证匿名会话、Origin、频率、单日配额和声明的 MIME/尺寸。
2. 服务端生成随机对象键及短时、受限的上传意图（平台支持时使用签名直传；否则使用受限 multipart 端点）。
3. 客户端上传 PNG 或 WebP。
4. 服务端确认对象存在，并校验 MIME、字节数、像素尺寸与数量限制。
5. 事务性地将对象键绑定到 `works`；生成公开分享所需的缩略图/合成图后才将作品设为 `ready`。

### 6.2 首发限制（数值按平台实测确定）

- 仅允许 PNG/WebP；
- 限制最大字节数、最大像素、最小画布尺寸；
- 每次创建最多一个原图；
- 按匿名会话、IP 和日期限制创建/涂鸦次数；
- 所有不合规请求在写入对象存储前拒绝。

### 6.3 访问分级

| 资源 | 可见性 | 访问方式 |
| :-- | :-- | :-- |
| 编辑原图 | 私有 | 仅所有者会话，通过受控 API 或短时签名 URL |
| 分享缩略图/合成图 | 公开（仅已发布） | 不可预测对象键、缓存策略 |
| 装饰静态资源 | 公开 | 构建静态资源或公共对象 |
| 涂鸦图层 | 默认私有/待审核 | 仅可见涂鸦才生成公开衍生图 |

上传中对象、失败绑定对象和已删除作品对象需有可重复执行的清理任务或明确保留期，并计入免费容量模型。

---

## 7. 安全、反滥用与免费额度保护

### 7.1 基线

- 写 API 验证会话，不接受裸 `userId`/`publicId` 作为授权。
- 对跨站写入校验 Origin，并对 Cookie 会话采用适当的 SameSite/CSRF 策略。
- 对创建、上传、抽奖、涂鸦和 OG 路由分别限速；所有限流失败默认拒绝写入，而不是放行。
- 服务端校验所有输入和对象元数据；不信任客户端给出的稀有度、飞镖结果、对象 URL 或文件类型。
- 记录最小必要审计信息（时间、匿名主体哈希、动作、结果/拒绝原因），避免不必要的个人信息。
- 公开内容应具备至少“关闭互动、删除、举报/人工隐藏”的处理路径。

### 7.2 高成本入口与保护

| 入口 | 主要风险 | 首发保护 |
| :-- | :-- | :-- |
| 创建作品 | 机器人刷存储、大文件 | 会话、尺寸/像素限制、日配额、IP/会话限流 |
| 抽奖 | 重放、并发、刷库存 | 会话、幂等键、数据库唯一约束与事务 |
| 涂鸦 | 骚扰、存储滥用、跨站写入 | 互动开关、每目标/来源上限、状态审核、Origin 校验 |
| OG | 爬虫放大计算 | 强缓存、按作品版本缓存、静态回退 |
| 分享页 | 热链和带宽异常 | 使用缩略图、缓存、禁止无界动态图层 |
| 邀请 | 自邀/刷量 | 完成首次有效操作后写入、唯一约束、限流 |

---

## 8. 项目结构与运行时约定

```text
my-soul-painter/
├── app/
│   ├── page.tsx                         # /
│   ├── create/page.tsx                  # /create
│   ├── p/[publicId]/page.tsx            # 公开分享页
│   ├── invite/[publicId]/page.tsx       # 邀请落地页
│   ├── api/
│   │   ├── works/route.ts               # 创建作品/上传会话
│   │   ├── works/[publicId]/route.ts    # 公开只读元数据
│   │   ├── draw/route.ts                # 一次性抽装饰
│   │   ├── scribbles/route.ts           # 涂鸦读写
│   │   └── og/[publicId]/route.ts       # 可选动态 OG
│   └── globals.css
├── components/
├── lib/
│   ├── auth.ts                          # 匿名会话与所有权校验
│   ├── db.ts                            # 关系数据库访问
│   ├── storage.ts                       # 上传意图、受控读取与删除
│   ├── rate-limit.ts                    # KV 或数据库慢路径限流
│   ├── draw.ts                          # 事务内抽奖逻辑
│   └── quota.ts                         # 免费阈值与功能开关
├── db/
│   ├── migrations/
│   └── seeds/
├── public/
│   └── assets/                          # 预置装饰等静态资源
├── next.config.ts
├── package.json
└── .env.local                           # 仅本地环境变量
```

不提供覆盖框架路由的 `vercel.json` `builds/routes` 配置。环境变量只记录名称与来源，不写入真实密钥，也不假定平台会用某种 `@secret` 字符串自动注入。

---

## 9. 迁移、种子、部署与恢复

### 9.1 四阶段流程

1. **平台核验**：确认免费计划是否满足静态托管、函数、数据库、对象存储、环境变量及地区/账号条件；记录超额行为。
2. **一次性基础设施初始化**：创建项目与资源、设置环境变量、记录资源归属与区域。此阶段不执行会重置业务数据的脚本。
3. **可重复迁移与版本化种子**：数据库迁移可重复执行；装饰种子有稳定 `code` 和版本；库存只由显式、幂等的管理命令初始化或调整。
4. **部署和发布后检查**：部署应用、检查迁移版本、验证对象权限、执行一次受控创建/抽奖/删除演练，并验证降级开关。

### 9.2 禁止的初始化方式

- 不在每次部署中执行 `SET deco:rare:stock = 1000` 或等价操作；这会重置已消耗库存。
- 不将数据库建表、业务种子、生产库存初始化混进构建或自动部署钩子。
- 不把环境变量中的 URL/Token 写进仓库或公开配置。

### 9.3 恢复原则

- 数据库事务失败时返回失败，不假装成功；对象绑定失败时保持 `uploading/failed` 状态并纳入清理。
- KV 不可用时转为数据库慢路径限流，或直接暂停匿名写入。
- 数据库或对象存储不可用时进入只读维护状态，避免产生不一致元数据。

---

## 10. 容量模型与免费内降级

### 10.1 不使用单点“数万用户”结论

容量必须按真实行为模型计算，而不是“每用户 1KB”或“每图 100KB”的单一假设。每次评估至少输入：

- 每日活跃用户、每日新作品数、峰值并发；
- 原图、缩略图、涂鸦图层的平均值和 P95 字节数；
- 每作品平均/高位分享读取次数与缓存命中率；
- 每日抽奖、涂鸦、邀请、OG 请求数量；
- 数据库行、索引、对象元数据、失败重试和日志开销；
- 爬虫、热链和滥用请求的安全系数；
- 平台免费限制、超额行为和数据保留策略。

每一项须映射到当前免费计划的已核验限制。任何无法用数据支撑的规模结论都应写成待验证假设。

### 10.2 免费内降级顺序

| 阈值 | 行为 | 保留能力 |
| :-- | :-- | :-- |
| 80% | 告警；降低单会话/单 IP 创建与涂鸦配额 | 创作、分享、抽奖 |
| 90% | 暂停高成本增强项：动态图层、动态 OG、非必要涂鸦 | 创作、分享、抽奖 |
| 95% | 暂停新作品创建与抽奖；拒绝新的大对象上传 | 已发布作品只读分享 |
| 免费能力不可用 | 显示维护状态；不自动启用付费资源 | 静态说明页；已缓存的只读内容视平台允许情况保留 |

阈值可按平台测量调整，但“**不自动付费、先降级后只读**”不得改变。

---

## 11. 上线验收清单

- [ ] 已完成所有服务的免费可行性核验，并记录日期、来源、账号/地域条件与超额行为。
- [ ] 页面、API、动态参数与 OG 只使用一种已验证的 Next.js 路由/运行时约定。
- [ ] `publicId` 不能执行任何写操作；所有写 API 均验证匿名会话、Origin 和限流。
- [ ] 创建/上传具备文件类型、字节、像素、频率与失败清理边界；私有原图不会默认公开。
- [ ] 并发抽奖测试证明每作品仅一条抽奖记录、库存永不为负、重试返回同一结果或安全失败。
- [ ] 稀有库存耗尽、数据库失败、KV 故障、对象上传失败时均不会产生跨系统不一致。
- [ ] 邀请无法自邀或重复归因；涂鸦具有关闭互动、限流、隐藏/删除路径。
- [ ] 迁移和种子可以重复运行，正常部署不会重置库存或业务状态。
- [ ] 80%/90%/95% 阈值下的功能开关已经演练，且不会自动升级到付费资源。
- [ ] 已完成最小化的创建、分享、抽奖、涂鸦、删除和只读降级端到端演练。
