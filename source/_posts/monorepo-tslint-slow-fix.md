---
layout: drfat
title: 解决 monorepo 工程 husky 提交慢的问题
tags:
  - monorepo
  - husky
  - eslint
date: 2022-03-06 23:16:04
---

业务发展了一年多，随着工程越来越大，发现在提交代码的时候，耗时会很久。最近在业务需求不是很紧的时候，就抽空研究了一下。

在提交代码的时候，触发了 husky 配置的 `pre-commit`的 git hooks。相信大家对于这个 git hook 不会很陌生，我们大部分需要团队合作的项目，为了约束大家的代码规范，通常会选择使用 husky 并且在提交前进行代码校验拦截，这个时机就刚好是 `pre-commit` git hooks 的时机。

所以问题一下就变得清晰起来，是 pre-commit 的 hook 执行的 lint 检查耗时过长。首先先介绍下我们工程的技术选型：yarn + learn + ts + react ，在正式排查前，猜测主要导致 lint 执行慢的因素大概有两个 monorepo（工程多、代码量大）、ts（ts 类型检查耗时）。

在开始排查问题之前，先做了个小测试：只改动了一个 tsx 文件，并尝试提交，计时发现，从开始 commit 到 commit 完成，发现竟然耗时了 1min+，晕~。这里就猜想会不会是某个 lint 规则 或 某个 lint 插件导致运行很慢的？接下来就沿着这个思路进行排查。 

<!-- more -->

由于工程里使用 lint 规则是继承公司的统一 lint 规则配置，而在打开 node_modules 里这份统一的规则集时，人傻了，一大堆的规则，浩如烟海，（他们大概是把每一条规则都自己定制了一遍吧~）。之后更加坚定了之前的想法：规则太多、插件太多，有可能是由于某几个规则或者插件拉低了整个 lint 的速度。

第一步是修改 .tslintrc.json，将文件里配置的工程规则去掉，然后添加上 eslint、react、tslint recommend 以及 airbnb 的 lint 规则。配置完成完成后，重新提交一个文件，发现速度很快，基本上是秒提交…… 这再次验证了之前的猜想：公司统一的lint规则中存在某些规则或者lint插件拖累了整个lint 的运行速度，而且由于一个文件的lint执行耗时 1min+，很可能是由于执行了 ts 编译，为了检测 ts 的类型这样。

带着这样的疑问，打开了 typescript-eslint 的官网，果然在这里找到了答案

[Linting with Type Information | TypeScript ESLint](https://typescript-eslint.io/docs/linting/type-linting#how-is-performance)

原文如下：
    
> Well (for full disclosure) there is a catch; by including `parserOptions.project` in your config, you are essentially asking TypeScript to do a build of your project before ESLint can do its linting. For small projects this takes a negligible amount of time (a few seconds); for large projects, it can take longer (30s or more).
    
> Most of our users are fine with this, as they think the power of type-aware static analysis is worth it. Additionally, most users primarily consume lint errors via IDE plugins which, through some caching magic, do not suffer the same penalties. This means that generally they usually only run a complete lint before a push, or via their CI, where the extra time really doesn't matter.
    
> **We strongly recommend you do use type-aware linting**, but the above information is included so that you can make your own, informed decision.
    

通过这篇文章，可以知道由于使用了「@typescript-eslint/recommended-requiring-type-checking」插件，会执行在执行 lint 前，为了校验 ts 的类型是否正确，从而去编译工程，而校验的范围由这么几个配置决定：

```jsx
module.exports = {
   root: true,
+  parserOptions: {
+    tsconfigRootDir: __dirname,
+    project: ['./tsconfig.json'],
+  },
 };
```

其中，parserOptions.tsconfigRootDir 告诉解析器项目根目录绝对路径，从而保证不会超过这个范围。parserOptions.project 告诉解析器配置文件 tsconfig.json 的相对路劲。

了解了这个规则之后，再回到我们的之前的初衷上来：我们想要提高 lint 的运行速度。那么自然我们面临几个选择：

1. 去掉 type checking，不检查 ts 类型，这样就会免去 ts 的编译过程，速度极大提升
2. 控制 type checking 的范围，当前工程的配置是会编译 monorepo 的所有项目，那如果配置成每个子项目只 check 到自己的根目录下，对于我们多个子项目的 monorepo 来说，速度也会有明显提升（PS：这里还需要注意，如果各个子项目互相有依赖的话，这种配置可能导致修改了一个子项目的类型，一个子项目的 tslint 并不会校验出来……）

第一种方案直接去掉类型校验，对于我们多人协作的项目来说不太可取，类型的校验还是比较重要的。所以我们选择了第二种！

其实，还有一种思路是 husky 拦截时不做 type check，可以结合 gitlab 的 pipeline 去做相关校验的事情。这种方案的问题是校验之后了，开发者提交了之后再发现问题，去改的动力可能就没有那么强了~