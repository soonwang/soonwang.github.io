---
layout: drfat
title: 搞清楚 eslint 的 plugins 和 extends
tags:
  - eslint
date: 2022-02-20 22:32:07
---


最近在鼓捣 eslint 规则配置的时候，有两个配置一直傻傻分不清，这两个配置就是 `extends` 和 `plugins`。相信大家在实践过程中也会遇到这样的困扰，今天就来一起看一看，彻底搞清楚。

首先，我们知道 eslint 是一个代码检查工具，它会根据我们在工程里配置的规则，来进行校验。我们常常在以下场景中使用到 eslint。
- vscode、webstorm 等编辑器、IDE安装插件
- 工程运行时，通过 eslint-loader 检查及时发现问题
- commit 时进行代码检查校验拦截（通常会配合 husky + lint-staged 使用）

所以一个团队如果想要保持统一的代码风格、良好的编码习惯，那约定和制定自己的 lint 规则就显得很重要。

### rules

在简单的场景中，我们可以不需要了解 plugins 和 extends 的概念，比如只是约定「封号」、「引号」的使用：
```json
{
    "rules": {
        "semi": ["error", "always"],
        "quotes": ["error", "double"]
    }
}
```
通过这样的配置，就约定了工程里统一强制使用封号结尾和双引号。

然而渐渐的，eslint 默认的一些规则不再满足我们的需要，这时我们就需要引入更多的规则集，这就是 plugins 的概念。

<!-- more -->

### plugins

plugins 可以理解为一个规则集，这些规则能够满足我们的一些特殊场景。比如在 react 工程里，我们需要对 react 代码进行某些特殊的校验，而 eslint 默认的规则已经满足不了我们的需求，这个时候就需要引入能够校验 react 代码的规则，比如 `eslint-config-react`。
引入一个 plugin，通常是两步：
1. 安装 plugin，例如 `npm i eslint-config-react -D`
2. 声明 plugin，在工程的配置文件中，比如`.eslintrc.json`中添加声明配置
```json
{
    "plugins": ["eslint-config-react"]
}
```
plugin 声明即 规则集已经准备好，下一步就是我们要决定在工程里启用哪些规则了，启用规则的方法就是上面所介绍的 rules，需要在 rules 里声明。

```json
{
    "plugins": ["eslint-config-react"],
    "rules": {
        "react/display-name": ["error"]
    }
}
```

在定制规则的时候，我们会发现 plugin 里提供了大量的 rules，如果诶个过一遍，决定在工程里应用哪些规则的话，显然会消耗我们大量的精力，而且每个人、每个团队都需要经历一遍，这显然是不合理的。这个时候就轮到我们今天的另一个主角出场了。

### extends
eslint 的 plugin 除了提供规则校验规则外，通常也会提供一些推荐的规则集，比如 `eslint-config-react:recommend`、`eslint-config-react:all`。这里的 recommend、all 就是 `eslint-config-react` 内置的一些规则集合，方便工程里直接使用，方法如下：
```json
{
    "extends": ["eslint-config-react:recommend"]
}
```
这样我们就很便利的应用了`eslint-config-react`插件推荐使用的规则。
为了看清 `eslint-config-react:recommend`具体应用了哪些规则，我们可以直接去看源码：https://github.com/yannickcr/eslint-plugin-react/blob/master/index.js
进入上面链接后，可以看到 `recommend` 下应用的全部规则如下：
```js
{
    plugins: [
    'react',
    ],
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
    },
    rules: {
    'react/display-name': 2,
    'react/jsx-key': 2,
    'react/jsx-no-comment-textnodes': 2,
    'react/jsx-no-duplicate-props': 2,
    'react/jsx-no-target-blank': 2,
    'react/jsx-no-undef': 2,
    'react/jsx-uses-react': 2,
    'react/jsx-uses-vars': 2,
    'react/no-children-prop': 2,
    'react/no-danger-with-children': 2,
    'react/no-deprecated': 2,
    'react/no-direct-mutation-state': 2,
    'react/no-find-dom-node': 2,
    'react/no-is-mounted': 2,
    'react/no-render-return-value': 2,
    'react/no-string-refs': 2,
    'react/no-unescaped-entities': 2,
    'react/no-unknown-property': 2,
    'react/no-unsafe': 0,
    'react/prop-types': 2,
    'react/react-in-jsx-scope': 2,
    'react/require-render-return': 2,
    },
}
```
此时，可以看出这个内容就是一份完整的 eslint 的配置文件。

总结一下，`plugins` 配置本质上是为了引入更多的校验规则方法，而仅仅引用规则是不会有任何效果的，还需要通过 `rules` 配置告诉 eslint 需要启用哪些规则。为了更方便的配置`plugins`和`rules`，可以配置`extends`使用 plugin 推荐开启的配置清单。

好了，这次介绍就到这里，如有错误的地方，希望不吝赐教。