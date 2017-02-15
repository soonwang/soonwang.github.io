---
title: 迭代器模式
date: 2017-02-15 16:43:34
tags:
  - 设计模式
---

记录迭代器模式
``` javascript

var agg = (function() {
  var index = 0,
      data = [1,2,3,4,5],
      length = data.length;
  return {
    next: function() {
      var element;
      if(!this.hasNext()) {
        return null;
      }
      element = data[index];
      index = index + 1;
      return element;
    },
    hasNext: function() {
      return index < length;
    },
    rewind: function() {
      index = 0;
    },
    current: function() {
      return data[index];
    }
  }
})();

while(agg.hasNext()) {
  console.log(agg.next())
}

```
