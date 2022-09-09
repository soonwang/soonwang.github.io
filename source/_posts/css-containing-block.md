---
title: CSS 包含块
tags:
  - CSS
date: 2019-08-30 10:17:00
---


## 确定包含块

1. position 为 static 或 relative，包含块 就是它最近的祖先**块**元素（比如：inline-block, block 或 list-item）或格式化上下文（BFC）的内容区
2. position 为 absolute，包含块就是它最近的position 不是 static的祖先元素的内容区 + padding区
3. position fixed，包含块是viewport

<!--more-->

> 如果 position 是 absolute 或 fixed，包含块也可能是由满足以下条件的最近父级元素的内容区+padding区

1. transform | perspective | filter 值不为none
2. will-change: transform | perspective | filter(filter只在Firefox上生效)
3. contain: paint (目前仅有chrome新版本支持)


## 根据包含块 计算 百分值

1. 要计算height、top、bottom 的百分值，是相对于包含块的height值。
2. 计算 width、left、right、padding、margin 这些属性由包含块的widt属性值来计算。


## 位置影响(left, right, top, bottom)

1. position relative 元素：针对 元素本身的移动，本身元素所占的盒模型位置不变，即不会影响 周围元素的位置
2. position absolute 元素：针对其包含块的相对位置。比如：left: 0，则 该元素距离 包含块的左侧为0px