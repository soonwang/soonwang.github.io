---
title: 订阅、发布模式
date: 2017-02-10 16:02:11
tags:
---

看汤姆大叔的博客，记录学习下订阅、发布模式

``` javascript

function Event(name) {
  var handlers = [];

  this.getName = function() {
    return name;
  };

  this.addHandler = function(handler) {
    handlers.push(handler)
  };

  this.removeHandler = function(handler) {
    for(var i = 0; i< handlers.length; i++) {
      if(handlers[i] == handler) {
        handlers.splice(i, 1);
        break;
      }
    }
  };

  this.fire = function(eventArgs) {
    handlers.forEach(function(h) {
      h(eventArgs);
    });
  };
}
```

<!-- more -->

``` javascript

function EventAggregator() {

  var events = [];

  function getEvent(eventName) {
    return events.filter(event => {
      return event.getName() === eventName;
    })[0]
  }

  this.publish = function(eventName, eventArgs) {
    var event = getEvent(eventName);

    if(!event) {
      event = new Event(eventName);
      events.push(event);
    }

    event.fire(eventArgs);
  };

  this.subscribe = function(eventName, handler) {
    var event = getEvent(eventName);

    if(!event) {
      event = new Event(eventName);
      events.push(event);
    }

    event.addHandler(handler);
  }

}

```
