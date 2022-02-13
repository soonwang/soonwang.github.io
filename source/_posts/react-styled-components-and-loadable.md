---
layout: drfat
title: styled-components 使用 loadable 懒加载时样式优先级问题
tags:
  - javascript
  - React
date: 2022-02-13 23:27:41
---

最近在 React 项目中引入 `@loadable/component` 进行懒加载优化时，发现了一个样式优先级问题。
我们工程里使用的是公司内部组件库，在想要覆盖组件库组件的样式时，基于 `styled-components` 的写法如下：
```typescript
import styled from 'styled-components';
import { Button } from 'xxx';

// 覆盖 Button 组件样式
export const CustomButton = styled(Button)`
    width: 80px;
    height: 32px;
`;
```
正常情况下，上述代码应该会生效，即最终展现在页面上的按钮样式宽度应该是 80 px，高度为 32 px，覆盖原 Button 组件的宽高样式。


但是在实际使用过程中，我们发现了一些异常：覆盖的样式会偶现失效的情况。有些时候自定义宽高会生效，有些时候自定义宽高不会生效。经过排查，发现如果是在`CustomButton`所在页面刷新，则按钮展示的宽高是符合预期的，如果是从其他页面进入的，则自定义宽高不会生效。没有生效的原因也很简单，`CustomButton` 的样式优先级排在了 `Button` 后面。

<!-- more -->

带着这样的问题我们去了解 `styled-components` 的机制。在默认情况下，`styled-components`会在 `<head>` 标签底部插入一个 `<style>` 标签，并把我们写的所有样式放入在这个标签里（可以这样理解）。在引入`@loadable/component`之前，工程在 Webpack 打包时，会把组件库的 css 样式提取出来单独生成一个 css 文件，并且在 html 文件中在 `head` 标签底部插入这个 css 文件链接。此时 `styled-components` 在运行时再在 `head` 底部插入一个 `style` 标签，这个标签就会在上面 css 文件链接的下面。所以根据 css 优先级规则，后插入的 `style`标签里的样式优先级更高，这个时候是没有问题的。

但是在引入 `@loadable/component` 之后，上面的过程不变（第一步提取的 css 样式可能会变小，因为要按需加载打包），在切换路由的时候，会自动去加载新路由下需要的静态资源文件，包括 js 和 css，这个时候依然 `loadable` 也会在 `head` 底部插入 css 文件链接来加载 css 文件。但是由于这个时候插入的 css 文件位于 `styled-components`生成的`style` 标签后面，所以此时 `loadable`按需加载的优先级会更高，这也解释了上面所描述的偶现情况，切换路由新加载的css样式优先级会更高，当前页面刷新的时候，`styled-comoponents`生成`style`标签的时机在 `loadable` 之后，所以这个时候 `styled-components` 的优先级更高。

了解原因之后，解决方案就比较容易想到了：调整 `styled-components` 或者 `@loadable/component`插入样式的位置，保证`styled-components`的优先级始终更高一些。
查阅 `styled-components` 文档和Github issue之后，我们发现有两种方案可以尝试。
1. 使用`StyleSheetManager`组件包裹页面，控制默认的插入位置：
```typescript
import { StyleSheetManager } from 'styled-components';

// 在 body 底部插入样式，优先级会比head 底部的 css优先级更高 
<StyleSheetManager target={document.body}>
</StyleSheetManager>
// ...
```
2. 如果希望加载在 body 顶部，有一个比较 hack 的方案，可以在 html 中设置一个空的 style 标签，并带上标记
```xml
<body>
    <style data-styled></style>
</body>
```
参考 https://github.com/styled-components/styled-components/issues/3181