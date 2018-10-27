---
title: eggjs启动从回车到ready
date: 2018-10-27 09:35:20
tags:
    - eggjs
    - javascript
---

JavaScript代码是单线程运行的，因而一旦有未捕获的异常抛出线程就会挂掉，业务也就不可访问了，所以一般我们在使用koa，express，thinkjs等其他node框架时一般会使用pm2去管理node进程，保证业务的高可用性。而阿里开源的egg框架本身自带的egg-cluster模板已经帮我们做了这个事情，egg的多进程模型和进程间通信官方文档上写的已经很清楚了，今天学习一下源码，希望有所收获。

## egg-bin dev

运行一个egg项目，`npm run dev`在package.json文件里我们发现默认其实执行的是`egg-bin dev`。egg-bin原来是egg提供的一个开发时使用的命令行工具，翻开egg-bin的代码，我们可以看到egg-bin其实是基于[common-bin](http://npm.taobao.org/package/common-bin)开发的，这里不赘述common-bin的用法，感兴趣的童鞋自行去查阅。在`lib/cmd/dev.js`里我们可以看到`egg-bin dev`执行的逻辑（去掉debug日志）：

<!-- more -->

``` javascript
* run(context) {
    const devArgs = yield this.formatArgs(context);
    const env = {
      NODE_ENV: 'development',
      EGG_MASTER_CLOSE_TIMEOUT: 1000,
    };
    const options = {
      execArgv: context.execArgv,
      env: Object.assign(env, context.env),
    };
    yield this.helper.forkNode(this.serverBin, devArgs, options);
  }
```
从上面代码可以看出主要有两步，
1. this.formatArgs(context)，将context上的参数转成自己需要的格式
2. this.helper.forkNode()，这个是`common-bin`的语法：

> forkNode(modulePath, args, opt) - fork child process, wrap with promise and gracefull exit

forkNode函数用于fork一个子进程，第一个参数子进程要执行的文件的路径
``` javascript
this.serverBin = path.join(__dirname, '../start-cluster');
```
`start-cluster`文件里主要源码如下：
``` javascript
const options = JSON.parse(process.argv[2]);
require(options.framework).startCluster(options);
```
到此我们知道整个`egg-bin dev`想要做的事情只有两件：
1. 获取参数options，重点是options.framework，即找到要加载的框架
2. 执行require(framework).startCluster()，加载框架并执行startCluster
回过头来继续看`lib/cmd/dev.js`，在`formatArgs`函数里我们找到获取framework的逻辑：
``` javascript
const utils = require('egg-utils');
argv.framework = utils.getFrameworkPath({
    framework: argv.framework,
    baseDir: argv.baseDir,
});
```
接下来我们去看下getFrameworkPath的实现逻辑。

## egg-utils

在`lib/framework.js`里我们很容易找到：
``` javascript
function getFrameworkPath({ framework, baseDir }) {
  const pkgPath = path.join(baseDir, 'package.json');
  assert(fs.existsSync(pkgPath), `${pkgPath} should exist`);

  const moduleDir = path.join(baseDir, 'node_modules');
  const pkg = utility.readJSONSync(pkgPath);

  // 1. pass framework or customEgg
  if (framework) {
    // 1.1 framework is an absolute path
    // framework: path.join(baseDir, 'node_modules/${frameworkName}')
    if (path.isAbsolute(framework)) {
      return framework;
    }
    // 1.2 framework is a npm package that required by application
    // framework: 'frameworkName'
    return assertAndReturn(framework, moduleDir);
  }

  // 2. framework is not specified
  // 2.1 use framework name from pkg.egg.framework
  if (pkg.egg && pkg.egg.framework) {
    return assertAndReturn(pkg.egg.framework, moduleDir);
  }

  // 2.2 use egg by default
  return assertAndReturn('egg', moduleDir);
}
```
上面代码详细讲述了获取framework的逻辑：
1. 首先看`npm run dev`执行时是否指定framework，有的话继续判断是否是绝对路劲，转为合适的格式返回
2. 尝试读取package.json，查看是否有egg以及egg的framework配置
3. 默认返回`egg`

这里我们看默认egg的情况，则forkNode执行的语句为`require('egg').startCluster(options)`

## require('egg').startCluster(options)

在egg的`index.js`文件的开头我们看到：
``` javascript
/**
 * Start egg application with cluster mode
 * @since 1.0.0
 */
exports.startCluster = require('egg-cluster').startCluster;

```
很好，终于看到`egg-cluster`了。

## egg-cluster

首先是`index.js`中暴露的startCluster方法，也是整个egg-cluster的入口方法：
``` javascript
exports.startCluster = function(options, callback) {
  new Master(options).ready(callback);
};
```
可以看出，egg-cluster是一个Master实例，Master就显得至关重要了。
介绍master之前先梳理一下egg-cluster的目录结构
```
egg-cluster
├── lib
│   ├── utils
│   │    ├── manager.js
│   │    ├── messenger.js
│   │    ├── options.js
│   │    └── terminate.js
│   ├── agent_worker.js
│   ├── app_worker.js
│   └── master.js
├── index.js
└── package.json
```
### Master
先看master.js，下面截取出Master构造函数的关键代码：
``` javascript
this.options = parseOptions(options);
this.workerManager = new Manager();
this.messenger = new Messenger(this);

ready.mixin(this);

//ready后的回调函数
this.ready(() => {...} );

// 添加监听事件，有agent-exit, agent-start, app-exit, app-start, reload-worker, realport
this.on('...', () => {...})
// 一次性监听事件，启动appWorkers
this.once('agent-start', this.forkAppWorkers.bind(this));

// forkAgentWorker
detectPort((err, port) => {
  this.forkAgentWorkder();  
});

// 监听agent、workder异常
this.workerManager.on('exception', ()=>{...})
```
从上往下执行，首先是parseOptions，这个函数是`lib/utils/options.js`，用来解析并返回正确格式的options

### options.js

``` javascript
function(options) {
    const defaults = {
        framework: '',
        baseDir: process.cwd(),
        port: options.https ? 8443 : null,
        workers: null,
        plugins: null,
        https: false,
    };
    options = extend(defaults, options);
}
```
上面代码片段仅截取部分，显示options的各个属性，和egg-bin dev提供的基本一致。具体的略过不讲。
接下来是new Manager();

### Manager

将manager.js里的属性和方法简单画成UML图形如下：

![image](https://haitao.nos.netease.com/769ea022-22ba-4861-80c6-ebf837f6e429_176_315.svg)

Manager主要是用于管理agent和worker，有两个方法比较特殊，分别是count()和startCheck()，count()返回agent和worker的数量，而startCheck()每10秒执行一次，判断count返回的agent和worker数量是否大于0，出现3次异常，则发出exception事件，并不再执行。

### Messenger

将messenger.js里的属性和方法简单画成UML图如下：

![image](https://haitao.nos.netease.com/8347fbea-a656-4971-ab24-9eb8a43e05cb_189_143.svg)

Messenger类
- send: 做了一些from和to的处理工作，并根据from和to，调用其他四个方法。
- sendToMaster: 使用的是this.master.emit方法，Master本身就是继承于EventEmitter，直接调用emit方法，使用master.on既可以监听到。
- sendToParent: 调用的是process.send()

> If Node.js is spawned with an IPC channel, the process.send() method can be used to send messages to the parent process. Messages will be received as a 'message' event on the parent's ChildProcess object.

- sendToAppWorker: 调用的是[sendmessage](https://npm.taobao.org/package/sendmessage)(worker, data);
- sendToAgentWorker: 调用的是sendmessage(agentWorker, data);

> sendmessage(childprocess, message): Send a cross process message. If a process is not child process, this will just call process.emit('message', message) instead.

### terminate.js

terminate.js文件主要用于终止进程，这里不再赘述。

### 启动agentWorker，agent_worker.js

回到Master的构造函数中，从之前整理出的代码片段来看，实例化manager，messenger之后，注册ready的回调函数，接下来就是启动agent进程了。
``` javascript
forkAgentWorker() {
    const agentWorker = child_process.fork('lib/agent_worker.js', args, opt);
    this.workerManager.setAgent(agentWorker);
}
```
上面片段仅截取关键部分。可以看出使用了node的原生模块`child_process`的fork方法。下面继续看`agent_worker.js`;
``` javascript
const Agent = require(options.framework).Agent;
const agent = new Agent(options);

agent.ready(err => {
  // don't send started message to master when start error
  if (err) return;

  agent.removeListener('error', startErrorHandler);
  process.send({ action: 'agent-start', to: 'master' });
});
```
从上面可以看到agentWorker实例了framework的Agent，而根据之前的分析，framework默认情况下是egg，这里为了简化分析，将framework认为是egg，那可以认为这个子进程执行了new Agent(options)操作；并且在ready回调中向master进程发送`agent-start`消息。而发送的这个消息则至关重要，master进程中对于它的监听回调函数中执行了worker进程的fork。

### 启动appWorker，app_worker.js

仍然回到Master的构造函数那里，可以看到
> this.once('agent-start', this.forkAppWorkers.bind(this));

当agentWorker进程启动ready后，发送agent-start消息给master进程，master进程第一次收到后执行forkAppWorkers();
``` javascript
forkAppWorkers() {
    cfork({
      exec: this.getAppWorkerFile(),
      args,
      silent: false,
      count: this.options.workers,
      // don't refork in local env
      refork: this.isProduction,
    });
    cluster.on('fork', worker => {...});
    cluster.on('listening', (worker, address) => {...});
}
```
[cfork](https://npm.taobao.org/package/cfork) npm包，使用原生cluster的setupMaster方法和fork方法。对cfork感兴趣的童鞋可以去[看](https://163.lu/k/htryK3)
> cluster fork and restart easy way

我们接着看简化版的app_worker.js
``` javascript
const Application = require(options.framework).Application;
const app = new Application(options);
process.send({ to: 'master', action: 'realport', data: port });
app.ready(startServer);
function startServer() {
    server.require('http').createServer(app.callback());
    server.listen(...args);
}
```
从上面可以知道，app_worker中执行了new Application()，并使用原生http（或https）模块启动一个server。当server执行listen方法时，触发了master中 forkAppWorkers方法中注册的listening回调事件
> cluster.on('listening', (worker, address) => {...});

该回调事件中向maste发送了`app-start`事件。
`app-start`的回调函数中在最后执行了
> this.ready(true);（这里使用了[get-ready](http://npm.hz.netease.com/package/get-ready)， 构造函数中通过`ready.mixin(this);`，注入ready方法，并添加回调函数）

这一句会触发master构造函数中注册的ready回调函数。该回调函数中将isStarted设置成true， 并想parent，app，agent发送`egg-ready`事件。

到这里启动就基本完成了。
启动的时序正如官方文档所描述的：
```
+---------+           +---------+          +---------+
|  Master |           |  Agent  |          |  Worker |
+---------+           +----+----+          +----+----+
     |      fork agent     |                    |
     +-------------------->|                    |
     |      agent ready    |                    |
     |<--------------------+                    |
     |                     |     fork worker    |
     +----------------------------------------->|
     |     worker ready    |                    |
     |<-----------------------------------------+
     |      Egg ready      |                    |
     +-------------------->|                    |
     |      Egg ready      |                    |
     +----------------------------------------->|
```

### 写在最后

本文只是简单的从源码角度大致梳理了egg启动过程中的做的一些事情，很多东西还需要进一步深入研究，比如`agent_worker.js`使用的是`child_process`的fork方法，而`app_worker.js`使用的是cfork（使用的是原生的cluster的fork），需要研究下child_process和cluster。此外，本文还没涉及到Agent和Application的具体的实现，Agent和Application都是基于EggApplication，而EggApplication是基于EggCore的，EggCore继承于Koa。等等。