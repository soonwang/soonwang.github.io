---
layout: drfat
title: monorepo commit 加速【第二弹】
tags:
  - monorepo
  - husky
  - eslint
date: 2022-09-04 15:36:39
---


随着业务的发展，monorepo 工程越来越大~
- 在 `git commit` 时耗时会比较久，耗时是大概 1min+；
- 在 `git merge release` 分支时耗时会更久，常常是 5min+;
所以在实际开发过程中，会发现有部分同学偶尔会跳过 git hook，跳过 lint 校验拦截，提交有类型报错的代码。

## 为什么会这么慢？
根据以往的工作经验，在没有用 ts 的工程里 lint 执行都是比较快的，所以这里猜想是 ts 的某些 rule 影响了整体的执行速度，终于在 typescript-eslint 找到了原因：[Troubleshooting & FAQs | TypeScript ESLint](https://typescript-eslint.io/docs/linting/troubleshooting/#my-linting-feels-really-slow)
![图片](/images/monorepo-commit-speed-up/feeling-slow.png)
![图片](/images/monorepo-commit-speed-up/how-is-perform.png)
如果我们在工程里开启了type-aware lint，那么执行 lint 的时间将会和构建时间一样长。
typescript-eslint  的一些 rules 是依赖 type information，所以在执行 lint 前会先编译一遍ts
[Linting with Type Information | TypeScript ESLint](https://typescript-eslint.io/docs/linting/typed-linting/) 官网这里具体描述了type-aware 是如何开启的：
![图片](/images/monorepo-commit-speed-up/lint-with-type.png)
1. 配置 `parserOptions`（tsconfigRoot、project）
2. 配置 `type-aware` 相关 rules

<!-- more -->

## 以前的优化
在之前也曾做过一次 commit lint 优化，当时的判断是 ts 类型信息校验是有必要的，贸然去掉 type 相关校验可能会有隐患。所以当时的思路是如何缩小编译范围。
默认在执行 lint 时，会构建整个 monorepo 的 ts 类型信息，项目越大，耗时会越久。
在这次优化里，是修改每个子项目里的 .eslintrc.js:
```javascript
module.exports = {
    root: true,
    parserOptions: {
      tsconfigRootDir: __dirname,
      project: ['./tsconfig.json'],
    },
}
```
新增了上面列出的两项配置：root、parserOptions，把需要构建生成 ts 类型的文件范围缩小到当前子目录。在实际测试中：
- 配置前，提交一个 ts 文件耗时 1min 1s
- 配置后，提交一个 ts 文件耗时 25s
基本是符合预期的，但是总体速度还是很慢，优化不明显，而且还带来额外的问题
带来的问题
由于缩小了构建生成 TS 类型的文件范围，所以当 features/common 和 features/pc 目录下文件类型有变化，而apps/clm 中未对应修改时，在 commit 时 lint 会忽略，不会拦截成功，存在一定风险。
 
## 新方案尝试
本次优化的目标：加快本地提交的速度，同时不能牺牲代码质量
为了加快本地 commit 速度，需要把耗时最久的 type-aware 相关的 rules 在 husky 时忽略，然后在 CI 时校验所有 rules，并及时通知校验结果。为了保证最终合代码时的质量，开启 MR 校验拦截。
大致思路如下： 
![图片](/images/monorepo-commit-speed-up/monorepo-commit-speed.excalidraw.png)

### 1. 配置 lint-staged 时关闭 type-aware rules
package.json: 
```json
"lint-staged": {
    "*.{ts,tsx}": [
      "node --max_old_space_size=16384 ./node_modules/eslint/bin/eslint.js --fix --color --cache --quiet --no-eslintrc --config .husky.eslintrc.js",
      "git add"
    ]
}
```

![图片](/images/monorepo-commit-speed-up/eslintrc-config.png)
https://eslint.org/docs/latest/user-guide/command-line-interface#-c---config
通过配置lint-staged命令，给 eslint 指定单独的配置文件，即.husky.eslintrc.js :
```javascript
module.exports = {
  root: true,
  extends: ["@byted-clm"],
  parserOptions: {
    tsconfigRootDir: null,
    project: null,
  },
  rules: {
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-for-in-array': 'off',
    '@typescript-eslint/no-implied-eval': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/unbound-method': 'off',
  },
  ignorePatterns: ['xxx']
}
```

关闭 type-aware 校验需要同时满足两个条件：
1. parserOptions.project: null，tsconfigRootDir: null
2. 关闭[相关 rules](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/recommended-requiring-type-checking.ts)

### 2. 配置 CI

在实际运行中，遇到了几个问题：
- lint 执行时，node 默认分配内存不够，在 pipeline 运行时会报错
- eslint 执行耗时 15min+，意味着 MR 时可能会卡很久……
下面分别说一下我的解决思路，也欢迎大家一起探讨。

#### a. Lint 内存不够
这个问题比较容易解决，重新分配更大内存即可。
package.json 中 新增 ci:lint 执行脚本：
```javascript
{
    "scripts": {
        "ci:lint": "node --max_old_space_size=16384 ./node_modules/eslint/bin/eslint.js  --ext .ts,.tsx --fix --color --cache --quiet ./"
    }
}
```

#### b. Pipeline 耗时长
Pipeline 耗时长有两处可优化点：
1. pnpm i 安装依赖耗时；
2. eslint 执行时间较长；

上面两个优化点均可通过缓存来解决，分别缓存 node_modules 和 .eslintcache

在第一次运行 pipeline 时，发现 eslint 执行耗时非常久，整体 pipeline 执行完成需要 15min ~ 20min。

可以想到，在 MR 的节点，因为 lint 需要卡这么长时间，也是很痛苦的。
那为什么在 pipeline 中执行 eslint 需要这么久呢？而本地执行 lint 的时候并不需要这么长时间的。
其中的奥妙依然是缓存！在本地工程运行时，可以看到根目录下生成了一个 .eslintcache 文件，而这个文件是我们在执行 lint 的时候加上 --cache 的效果：

在 pipeline 执行时，工程是从 git clone 的，而 .eslintcache 文件是 gitignore 的。
那为了给 eslint 加速，我们需要在 ci 里缓存 .eslintcache 文件。
这里大家可以再思考下，既然 .eslintcache 缓存可以加快速度，那 ts 的编译是否可以利用缓存加速 type 信息的生成呢？

> eslint cache 还有一个细节点：在 pipeline 中执行 eslint 时，还需要设置 --cache-strategy content
> ![图片](/images/monorepo-commit-speed-up/eslint-cache-strategy.png)

设置缓存策略后 pipeline 执行时间锐减：5-6min

| 优化前 | 优化后 |
|  ----  | ----  |
| - git commit:  1min+；            | - local git commit:  10s 左右；|
| - git merge release 分支： 5min+； | - ci lint命中缓存时：4min-6min左右；|
| -                                 | - ci lint 未命中缓存时：15-20min；|

