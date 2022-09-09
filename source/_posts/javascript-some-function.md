---
title: 记录一些函数
date: 2017-02-09 14:22:31
tags:
  - javascript
---
#### 将#ffffff转化成rgb(255,255,255)
``` javascript
function colorTranslator(str) {
  var arrColor = str.slice(1).match(/\w{2}/g)
  return 'agb('+ arrColor.map(item => parseInt(item, 16) || 0).join(',') +')'
}
console.log(colorTranslator('#ffffff'))
```
<!-- more -->

#### 将'get-element-by-id'转化成驼峰式'getElementById'
``` javascript
var foo = 'get-element-by-id'

var camel = function(str) {
  var newStr = ''
  str.split('-').map((item, index) => {
    if(index === 0) {
      newStr += item
    } else {
      newStr += item.charAt(0).toUpperCase() + item.slice(1)
    }
  })
  return newStr
}

console.log(camel(foo))
```
Vue里的做法是通过正则表达式
``` javascript
var foo = 'get-element-by-id'
var camelizeRE = /-(\w)/g
var camelize = function(str) {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
}
console.log(camelize(foo))
```
