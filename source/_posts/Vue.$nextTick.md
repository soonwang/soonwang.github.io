依稀记得第一次接触Vue.$nextTick是在之前某个项目从Vue 1.x升级到Vue 2.x时，发现vue实例的生命周期钩子函数都变了。查阅Vue官方提供的升级文档时发现，ready被mounted钩子函数替代，文档还特别提出，mounted并不保证钩子函数中的this.$el在document中，需要使用vm.$nextTick，那时起就觉得$nextTick好神奇。今天就来谈（xia）谈（che）Vue的异步实现$nextTick。

## 0 浏览器事件循环机制

在谈$nextTick之前，当然要先温习一下浏览器的事件循环啦。ps：各位对浏览器事件循环机制了如指掌的看官可以直接跳过了。

### 0.1 单线程和异步

我们都知道js是单线程的，js引擎负责解释执行js的只有一个线程，就是我们所谓的主线程，而一些异步回调函数会被放到任务队列中，当主线程空闲时，会执行任务队列中的回调函数。

### 0.2 tasks (macroTasks) 和 microTasks

event loop中有两种类型的任务队列，tasks（macroTasks）和mircroTasks。
- tasks: 执行主线程js代码、网络请求、页面加载、输入、点击事件以及定时器事件（setTimeout,setIntervel,setImmediate）等。
- microTasks: 更新应用程序状态的任务，常见的有promise，process.nextTick，MutationObserver，Object.observe等

### 0.3 来做个题吧

先看下面的js代码，写出执行执行结果
```
console.log('script start');

setTimeout(function() {
  console.log('setTimeout');
  Promise.resolve().then(function(){
      console.log('promise in setTimeout');
  })
});

Promise.resolve().then(function() {
  console.log('promise1');
  setTimeout(function() {
    console.log('setTimeout in promise1');
  });
}).then(function() {
  console.log('promise2');
});

console.log('script end');
```

### 0.4 event loop 处理顺序

ps: 觉得毫无难度的大大可以跳过了。
执行的结果是：
``` bash
script start
script end
promise1
promise2
setTimeout
promise in setTimeout
setTimeout in promise1
```

先看下“圣经”的解释（颤颤抖抖打开为[w3c](https://www.w3.org/TR/2017/REC-html52-20171214/webappapis.html#event-loops-processing-model)）
> 1. Select the oldest task on one of the event loop’s task queues, if any, ignoring, in the case of a browsing context event loop, tasks whose associated Documents are not fully active. The user agent may pick any task queue. If there is no task to select, then jump to the Microtasks step below.
> 2. Set the event loop’s currently running task to the task selected in the previous step.
> 3. Run: Run the selected task.
> 4. Set the event loop’s currently running task back to null.
> 5. Remove the task that was run in the Run step above from its task queue.
> 6. Microtasks: Perform a microtask checkpoint.
> 7. Update the rendering: If this event loop is a browsing context event loop (as opposed to a Worker event loop), then run the following substeps.（此处省略，感兴趣的大佬请移步w3c）
> 8. If this is a Worker event loop (i.e., one running for a WorkerGlobalScope), but there are no tasks in the event loop’s task queues and the WorkerGlobalScope object’s closing flag is true, then destroy the event loop, aborting these steps, resuming the run a worker steps.
> 9. Return to the first step of the event loop.

好了，上面解释的很清楚了，我就不翻译了（各位大大英语肯定都比我好，逃）
下面放上一张网上盗的图
![image](https://haitao.nos.netease.com/7957a9f2-0988-4d29-a87f-39956c294552_436_529.jpg)

总结起来就是，在一次事件循环里

- 先判断macroTask queue是否为空，空的话直接下一步，不为空的话只取出一个task执行，执行完下一步
- 再判断microTask queue是否为空，空的话直接下一步，不为空的话会取出一个task执行，执行完重复这一步，直到队列为空
- 更新渲染

## 1. Vue.$nextTick

### 1.1  nextTick 使用

这里引用一下Vue官网文API上的例子

```
// 修改数据
vm.msg = 'Hello'
// DOM 还没有更新
Vue.nextTick(function () {
  // DOM 更新了
})

// 作为一个 Promise 使用 (2.1.0 起新增，详见接下来的提示)
Vue.nextTick()
  .then(function () {
    // DOM 更新了
  })
```
> 在下次 DOM 更新循环结束之后执行延迟回调。在修改数据之后立即使用这个方法，获取更新后的 DOM。

为什么在修改了数据之后DOM没有立即更新，而立即使用nextTick就能在回调里获取到更新后的DOM呢。带着这样的疑问我们先去看下nextTick的实现。

### 1.2 nextTick 实现

目前我看的vue代码版本是2.5.17-beta.0，此版本中nextTick的实现在 `src/core/util/next-tick.js`中。源码100+行，这里就不贴了，感兴趣的童鞋请[移步](https://github.com/vuejs/vue/blob/dev/src/core/util/next-tick.js)。
nextTick文件暴露了两个函数，nextTick和witchMacroTask。先看nextTick
```
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
```
1. 先判断cb是否存在，存在则返回callbacks数组里
2. 判断!pending，即判断上一次异步回调是否已执行，若已执行，再判断是否使用macroTask（默认不），决定添加到macroTask还是microTask
3. 如果cb不存在且浏览器支持Promise，则返回Promise

next-tick文件里有个变量 `callbacks`, `callbacks`是一个任务队列，nextTick会把cb都放入到这个队列里。使用callbacks而不是在nextTick中直接执行回调函数的原因是保证在同一个nexTick内执行完之前tick的所有异步任务，将多个异步任务压成一个同步任务，在下一个tick执行完毕。

flushCallbacks用于遍历callbacks并执行回调，并将pending设置为false，表示可以开始下一个tick。

macroTimerFunc会依次从setImmediate，MessageChannel，setTimeout中取，而microTimerFunc则先检测浏览器是否原生支持Promise，不支持则指向macroTimerFunc的实现。这两个函数中都会异步调用flushCallbacks，默认使用microTimerFunc。

看到这里，我们大概知道了nextTick做的事情了，可是之前的疑问还是没有得到答案啊，为什么修改了数据之后，需要在下一个tick里才会更新呢？好吧，接下来再去扒一扒源码。

## 2. 响应式原理

Vue使用Object.defineProperty把对象的属性转为getter/setter，这是响应式的核心，也是Vue不支持IE8以及更低版本浏览器的原因。下面是从官网盗的一张图。
![image](https://haitao.nos.netease.com/58ee9280-643d-45e7-86dd-2f9f2726ff13_1200_750.png)

从上图可以知道，Data变化之后会Notify Watcher，而Watcher又会触发re-render。哦，原来是这样，但是还是不知道为什么修改Data之后一定要nextTick，Dom才会更新啊，继续低头扒代码...

### 2.1 Observer

Vue的Observer类的实现在`src/core/observer/index.js`，为了省点墨水这里就不填代码了，少侠请[移步](https://github.com/vuejs/vue/blob/dev/src/core/observer/index.js)。

![image](https://haitao.nos.netease.com/c1bb3289-6c83-4279-b2eb-559600384d20_2118_1262.jpg)

上面这张图是我根据代码画的（这么丑一看就知道肯定自己画的，凑合着看）。

Observer类的主要作用是给对象的属性添加getter和setter，收集依赖和派发更新。
defineReactive方法最为重要，它就实现了给对象属性添加getter和setter，收集依赖和派发更新。下面截取关键的源码（有删减）：
```
let childOb = !shallow && observe(val)
Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })

```
可以发现，defineReactive在getter和setter方法中分别实现了依赖收集和更新派发。

getter中执行完原getter之后，先判断Dep.target，在dep.depend()，并把val也都设置成响应式并收集了依赖。厉害啊！哎等等，Dep.target是什么？为什么要先判断这个呢？

setter中先判断val是否有改变，执行完原setter后（将newVal也设成响应式），dep.notify()。奥，仿佛明白了什么...

哎喂，Dep是什么？一开始都没说啊，从哪冒出来的？别急，我们接着看

### 2.2 Dep

Dep类的实现在`src/core/observer/dep.js`，照例，少侠请[移步](https://github.com/vuejs/vue/blob/dev/src/core/observer/dep.js)。

照例，上图

![image](https://haitao.nos.netease.com/a628c51f-1321-4228-8938-b5b2321d346f_800_1072.jpg)

图上很明显（强行很明显），能找到上面Observer defineReactive方法用到的那几个方法，depend,notify,以及静态属性Dep.target，这下全明白了吧？并没有，Dep.target默认是null，不可能一直是null的呀，一直是null的话，那defineReactive的判断永远不会true啊。还有，subs是啥，notify里怎么还能update呢？哎，接着看吧emmmmm...

### 2.3 Watcher

Watcher类的实现在`src/core/observer/watcher.js`，你懂的，请[移步](https://github.com/vuejs/vue/blob/dev/src/core/observer/watcher.js)。

![image](https://haitao.nos.netease.com/95ab0e44-2624-46fb-8fd6-f0c0f0313ba8_2326_1596.jpg)

Watcher有众多属性，其中deep,computed,user,sync,before对某些流程会有些影响的。对于普通的Watcher（非computed），constructor时会执行get方法。

get方法里我们一眼看到了pushTarget(this)，popTarget()，正是上面Dep中所看到的。讲道理，在Observer的defineReactive方法中，getter时判断Dep.target是否为空，不为空才会收集依赖，而此处成对出现的pushTarget和popTarget仿佛就是告诉我们，get方法里，pushTarget和popTarget中间肯定会执行Observer的getter。为了方便解释，贴一下get的代码（有删减）：
```
pushTarget(this)
let value
const vm = this.vm
try {
    value = this.getter.call(vm, vm)
} catch (e) {
    throw e
} finally {
    popTarget()
    this.cleanupDeps()
}
return value
```
看过来看过去，最可疑的就是try的那一句 `this.getter.call(vm, vm)`。看下constructor中，原来this.getter是从expOrFn来的，是构造函数的第二个参数。这里先看到这里，继续看。
addDep，在Dep类的depend方法中，就是调用Dep.target.addDep方法，当Watcher get方法中pushTarget(this)，这个时候我们知道，此时Dep.target就是Watcher实例，addDep也就是这里addDep方法。
addDep将Dep的实例放入到Watcher实例的newDeps数组中，并将当前Watcher实例放入Dep实例的subs中（做了去重），实现依赖收集（好像有点绕）。

接下来重点来了，update方法，Dep的notify方法就是调用sub的update方法，也就是这里的update方法，定睛一看，对于普通watcher（非computed、非sync）来说，update调用的就是`queueWatcher(this)`；贴代码（删除注释）为证：
```
  update () {
    if (this.computed) {
      if (this.dep.subs.length === 0) {
        this.dirty = true
      } else {
        this.getAndInvoke(() => {
          this.dep.notify()
        })
      }
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }
```
那`queueWatcher`又是啥玩意呢，看到queue感到莫名的兴奋，觉得答案就在眼前！

### 2.4 queueWatcher

```
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
```
嗯，按捺不住内心的欢喜，直接贴上了代码（连注释都来不及删了）。从下往上看，果然我看到了nextTick。接着看queueWatcher做了什么（源码请移步[scheduler](https://github.com/vuejs/vue/blob/dev/src/core/observer/scheduler.js)）

- 看watcher是否已在队列，不在继续执行（在的话返回）
- 当前没有执行flush队列时，直接将watcher push到队列里，否则安装watch id的大小插入到队列里的相应位置（flush队列时会先排序在执行，这里插到对应位置防止顺序乱了）。
- 如果当前不在flush或者flush已结束，则开始新的flush，nextTick(flushSchedulerQueue)。
- flushSchedulerQueue 里先按watcher id大小排序，执行watcher.run()，最后执行active 和 update的钩子函数。

到这里我们好像知道了答案，修改Data之后，通知到watcher更新时，使用了nextTick去执行队列。

到此结束了吗？当然还没完啊，还记得那年大明湖畔的夏雨荷吗？啊呸，还记得Watcher get方法里的getter方法，到底是不是getter里执行到了Observer。哦，假装不记得的童鞋可以散了先。

## 3. Vue 实例

废话不多说，先上图

![image](https://haitao.nos.netease.com/d6b0b8fb-d4e2-4a90-a8d3-fb9f987b6008_2144_1510.svg)

`src/core/instance/index.js`是Vue实例的入口，Vue.prototype._init定义在`src/core/instance/init.js`，`_init`的在最后执行`vm.$mount()`,这里是将vue实例挂载到dom上的关键一步。

在`src/platforms/web/runtime/index.js`找到一处Vue.prototype.$mount定义（vue的编译入口有多个），这里的$mount实际调用的是`src/core/instance/lifecycle.js`中的mountComponent方法，这个方法里果然看到了两个重要的生命周期钩子函数的调用，根据Vue官网文档说明，Vue实例的挂载就应该是在两个钩子函数之间，上代码（关键代码）：
```
  updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
```
很明显，mountComponent里调用new Watcher()生成一个renderWatcher，传入的getter正是updateComponent，updateComponent里调用`vm._update(vm._render())`，继续追查。

在`src/core/instance/render.js`中找到`Vue.prototype._render`的定义，原来`_render`调用的是`vm.$createElement`，而`vm.$createElement`定义在initRender中，使用的`src/core/vdom/create-element.js`。好了绕了一大圈终于找到了，从代码上看，createElement最终返回的是一个vnode，而在vnode的constructor里进行赋值就会触发Data的getter，getter里的Dep.target此时正是刚new的renderWatcher，依赖收集完成（在vue实例的iniMixin已经执行过initData，data早就是响应式的了）。

修改数据触发更新时，renderWatcher会被push进queue里，nextTick时renderWatcher调用run方法，run方法调用getAndInvoke方法，而getAndInvoke方法会调用get方法，get方法则会执行getter，也就是updateComponent，`vm._render()`返回一个新vnode，而`vm._update`会调用`vm.__patch__(preVnode, vnode)`，重新渲染。

好了，终于理（che）完了。

## 参考：

- [Vue.js技术揭秘](https://ustbhuangyi.github.io/vue-analysis/)
- [深入理解js事件循环机制（浏览器篇）](http://lynnelv.github.io/js-event-loop-browser)