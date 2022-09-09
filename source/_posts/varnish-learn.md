---
title: Varnish 入门
date: 2019-03-13
tags:
    - varnish
    - 缓存服务器
---
Varnish是一款高性能、开源的反向代理服务器，支持负载均衡，经常被用作缓存服务，能够极大的提高网站的响应速度。

Varnish 进程分为master进程和worker进程，master进程负责读取配置文件、创建和管理子进程等，worker进程则负责处理请求。一旦子进程挂了，master进程会立即重新启动子进程。

## 安装

mac 上安装可以使用Homebrew
```
$ brew install varnish
```

<!-- more -->

启动命令（后台运行）

```
$ brew services start varnish
```

默认端口是8080，可以在plist中修改端口

`~/Library/LaunchAgents/homebrew.mxcl.varnish.plist`

- n：运行目录路径
- f: 配置文件路径
- a: 启动端口
- s：缓存方式

varnish的默认配置文件位置位于`/usr/local/etc/varnish/default.vcl`

通过homebrew安装的varnish，在调试配置文件时使用varnishlog会提示`VSM: Could not get hold of varnishd, is it running?`

## Varnish 配置语言 VCL

### 运算符 Operator

- = 赋值
- == 比较
- ~ 匹配，可以使用正则表达式，或者ACLs
- ! 否定
- && 逻辑与
- || 逻辑或

### 条件语句

- if、else、elseif（elsif | elif | else if 四个都一样）
- **没有循环语句**

### 数据类型

- 五种数据类型：String， boolean，time，duration，integer
- 使用`set` 和 `unset` 设置或者移除

```
set req.http.User-Agent = "unknown";
unset req.http.Range;
```

#### 字符串

- 基本的字符串形式使用双引号 "..."，不允许跨行
- 反斜杆不是特殊符号，所以不需要对反斜杠进行转义
- 比较长的字符串可以使用{"..."}，可以包含双引号、换行符等，不包含NUL（0x00）

#### Time

- now 函数返回当前时间
- 在字符串上下文，返回格式化的字符串

#### Duration

number + 时间单位，比如： 1.5w

- ms: milliseconds
- s: seconds
- m: minutes
- h: hours
- d: days
- w: weeks
- y: years

### 正则表达式

Varnish 使用 Perl-compatible regular expressions（pcre）

``` 
if (req.http.host !~ "(?i)example\.com$") {
    ...
}
```

### include 引入VCL文件

```
include "foo.vcl";
```

### import 加载 Varnish模块（VMODS）

```
import std;
sub vcl_recv {
    std.log("foo");
}
```

### 注释

- 单行注释： `#`、 `||` 
- 多行注释： `/* block */`


### 定义 backend

varnish中的backend 和 nginx里 upstream 中 server概念很像，一个backend对象指定服务的host和端口，包括类似于健康检查的机制

定义一个 backend 如下：

```
backend name {
    .attribute = "value";
}
```

常用属性有 host（必填）、port、probe（类似于健康检查机制，后面会写到）

### 定义 Probes

probe 用于 请求 backend 状态，backend返回的状态不符合预期，则会标记该backend下线

定义一个name为 healthcheck的 probe
```
probe healthcheck {
    .url = "/health/check";
    .timeout = 2s;
    .interval = 5s;
    .expected_response = 200; # 服务正常返回的http状态码
}
```

结合 backend使用，定义一个

```
backend default {
    .host: "127.0.0.1";
    .port: 8080;
    .probe: healthcheck;
}
```

### director 多个后端集合，负载均衡 

```
director fed round-robin {
    {
        .backend = fed1;
    }
    {
        .backend = fed2;
    }
}
```

### acl 权限控制列表（Access control lists）

```
acl local {
    "localhost";
    "127.0.0.1";
}
```

匹配ip地址的时候，使用匹配运算符

```
if (client.ip ~ local) {
    return (pipe);
}
```

### 子程序 Subroutines

```
sub pip_if_local {
    if (client.ip ~ local) {
        return (pipe);
    }
}
```

- 子程序中不能引入参数，也没有返回值
- varnish 内置子程序 命名为vcl.*，自定义子程序不能以`vcl`开头
- 调用子程序，使用关键字 `call` 后面跟上子程序名字
```
call pip_if_local;
```

## 几个常用的内置子程序

### vcl_recv

用于接收和处理请求。

举个栗子：
```
sub vcl_recv {
    if (req.url ~ "/public/") {
        return (hash);
    }
    return (pass);
}
```
上面代码将请求中匹配`/public/`的请求，进入hash阶段，请求转到`vcl_hash`，其余请求进入pass模式，处理转到`vcl_pass`

return 支持5个参数：
- hash：进入`vcl_hash`
- pass: 进入`vcl_pass`
- pipe: 进入`vcl_pip`
- synth(status code, reason)： 进入`vcl_synth`
- purge：清除缓存

### vcl_backend_fetch

在向后端发请求前执行，这个阶段可以修改请求。

```
sub vcl_backedn_fetch {
    unset bereq.http.Cookie;
    return (fetch);
}
```

return 支持两个参数
- fetch：发送请求到后端
- abandon： 放弃请求后端。

### vcl_backend_response

当从后端获取到请求响应头后执行，可以在这个阶段处理删除或添加响应头的事情。

```
sub vcl_backend_response {
    set beresp.ttl = 5m;
    unset beresp.http.Set-Cookie;
    return (deliver);
}
```
上面例子设置资源的缓存时间、删除请求响应头里的Set-Cookie。
return 支持三个参数
- deliver： 返回数据给用户端
- abandon：放弃后端请求，resp.status 为 503，进入`vcl_synth`
- retry：重试后端事务，达到最大次数限制后进入`vcl_backend_error`


### vcl_deliver

当从后端获取到所有信息后，在返回用户前执行。
```
sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Varnish-Cache = "HIT";
    } else {
        set resp.http.X-Varnish-Cache = "MISS";
    }
    return (deliver);
}
```
上面代码中判断是否是命中缓存，并在响应头中显示。
return支持 三个参数：
- deliver 返回数据给用户端
- restart 重新启动事务。增加了重新启动计数器。如果重启的次数超过了max_restarts的设置，就会抛出一个错误
- synth(status code, reason) 带着synth的参数resp.status和resp.reason转到vcl_synth处理。


### vcl_init

在VCL加载完成，请求进入之前执行，一般用来初始化VMODs

```
import directors;    # load the directors

backend server1 {
    .host = "127.0.0.1";
}
backend server2 {
    .host = "xxxxxxxxx";
}

sub vcl_init {
    new bar = directors.round_robin();
    bar.add_backend(server1);
    bar.add_backend(server2);
    return (ok);
}

sub vcl_recv {
    
    set req.backend_hint = bar.backend();
}

```

return 支持两个参数
- ok 正常返回，继续
- fail 终止加载VCL

### vcl_fini

在所有请求都处理完，VCL被丢弃后执行，一般用来清理VMODS。return (ok)。


更多详细的内置子程序可以参考:

- https://jefferywang.gitbooks.io/varnish_4_1_doc_zh/content/chapter4_2.html
- https://varnish-cache.org/docs/4.1/users-guide/vcl-built-in-subs.html#vcl-built-in-subs

varnish的内置子程序 调用状态可以看官网的两张张图：

- Client端：

![image](https://kaola-haitao.oss.kaolacdn.com/dfe8e572-93e7-4474-a8d5-a97fab3b113b_1011_1387.svg)

- Backend端：

![image](https://kaola-haitao.oss.kaolacdn.com/9ef88c3c-bdb2-455c-afc0-df24e71e53c6_976_913.svg)

## 请求中的几个对象

- req： 请求对象，在客户端阶段都存在
- bereq：backend的请求，varnish在发送到backend之前构造的bereq，基于req创建
- beresp：backend的响应对象
- resp：返回给用户之前的响应，可以在vcl_deliver中修改
- obj：大部分只在`vcl_hit`中，obj.hits 标识是否命中缓存，也存在于`vcl_deliver`

## 调试配置文件

使用std模块 和 varnishlog 可以 看到varnish 处理请求的各个状态的日志。

```
vcl 4.0;
import std;

sub vcl_recv {
    std.log("vcl_recv req.url: " + req.url);
}

```

然后在命令行中使用 `varnishlog -g raw`即可看到varnish处理请求的各个状态。
需要注意的是，`varnishlog`命令可能没有注册到全局，需要自行定位到bin文件下执行。

## 参考：

- https://varnish-cache.org/docs/4.1/reference/vcl.html#vcl-7
- https://varnish-cache.org/docs/4.1/users-guide/vcl-built-in-subs.html
- https://jefferywang.gitbooks.io/varnish_4_1_doc_zh/content/chapter1.html
- https://www.ibm.com/developerworks/cn/opensource/os-cn-varnish-intro/index.html