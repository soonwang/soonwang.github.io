---
title: BFC
date: 2019-09-02 09:59:00
tags:
  - CSS
---

## BFC 概念

BFC 即 Block Formatting Contexts（块级格式化上下文），属于普通流定位。具有BFC特性的元素可以看做是隔离了的独立容器，容器里面的元素不会再布局上影响到外面的元素。

<!-- more -->

## BFC 触发条件

- body 根元素
- 浮动元素：float 值非 none
- 绝对定位元素：position absolute、fixed
- display： inline-block、table-cell、table-caption
- overflow 值 非 visible（hidden、auto、scroll）

## BFC 特性 及 应用

1. 在一个BFC中，两个相邻的块级盒子的垂直外边距会产生折叠。不同 BFC 不会 发生 margin 折叠
2. 在 BFC 中，每一个盒子的左外边缘（margin-left）会接触到 容器的 左边缘（border-left)
3. 可以阻止元素 被 浮动元素 覆盖
4. 清除元素内部浮动
