---
title: 对象创建模式创建--沙盒模式
date: 2017-02-21 13:38:23
tags:
 - 设计模式
 - javascript
---

看汤姆大叔的博客，记录一下对象创建模式里的沙盒模式
沙盒模式即是为一个或多个模块提供单独的上下文环境，而不会影响其他模块的上下文环境，比如有个Sandbox里有3个方法event，dom，ajax，在调用其中2个组成一个环境的话，和调用三个组成的环境完全没有干扰。Sandbox实现代码如下：
``` javascript

function Sandbox() {
  var args = Array.prototype.slice.call(arguments),
    //最后一个参数为callback
    callback = args.pop(),
    //除最后一个参数外，其他均为要选择的模块
    modules = (args[0] && typeof args[0] === 'string') ? args : args[0],
    i;

    //强制使用new 操作符
    if(!(this instanceof Sandbox)) {
      return new Sandbox(modules, callback);
    }

    //添加属性
    this.a = 1;
    this.b = 2;

    //向this对象上添加模块
    //如果没有传模块或者传入的参数为"*"，则认为传入所有模块
    if(!modules || modules == '*') {
      modules = [];
      for(i in Sandbox.moduls) {
        if(Sandbox.modules.hasOwnProperty(i)) {
          modules.push(i);
        }
      }
    }

    //初始化需要的模块
    for(i = 0; i<modules.length; i+=1) {
      Sandbox.modules[modules[i]](this);
    }

    //调用callback
    callback(this);
}

//默认添加原型对象
Sandbox.prototype = {
  name: 'My Application',
  version: '1.0',
  getName: function() {
    return this.name;
  }
}
```
<!-- more -->

然后在定义默认的初始模块
``` javascript
Sandbox.modules = {};

Sandbox.modules.dom = function(box) {
  box.getElement = function() {

  };
  box.getStyle = function() {

  };
  box.foo = 'bar';
};

Sandbox.modules.event = function(box) {
  box.attachEvent = function() {

  };
  box.detachEvent = function() {

  };
};

Sandbox.modules.ajax = function() {
  box.makeRequest = function() {

  };
  box.getResponse = function() {

  };
};

```

调用方式如下：
``` javascript
Sandbox(['ajax', 'event'], function(box)) {
  console.log(typeof box.foo); //undefined  
};

Sandbox('ajax', 'dom', function(box) {
  console.log(typeof box.attachEvent) //undefined
});

Sandbox('*', function(box) {
  console.log(box); //所有方法对象
})

```
