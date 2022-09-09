---
title: kali2安装vnc server记录
date: 2018-01-12 19:13:48
tags: 
  - kali
  - vnc server
---
在kali2上安装vnc server的过程中遇到一些问题，记录总结下

- 安装vnc server，选择vnc4server，执行命令
``` bash
sudo apt-get install vnc4server
```
- 首次启动vncserver 执行命令 
``` bash
sudo vncserver
```
- 首次启动，需要输入密码和验证密码，以及一个是否设置【只读】密码，会保存在~/.vnc/passwd中
- 启动时，往往会报错，此时在~/.vnc/中查看是否有xstartup文件，没有新增一个，默认可以写入
``` bash
$ cat ~/.vnc/xstartup 
#!/bin/sh
xterm &
```
- 在vnc viewer中连接vnc server，ip+桌面号或者端口号，

<!-- more -->

## 异常情况

### vnc viewer连接问题
此时一般会有两种异常情况
1. 一种是timeout，等待很长时间，然后提示超时，这种情况要检查网络，vnc server所在主机是否开放相应的端口（linux可以使用ufw管理软件）；
2. 另一种异常是refused，可以尝试使用
``` bash
telnet {ip} {port}
```
远程测试vnc server所在主机是否refused，如果refused，ssh远程登录到该主机，使用
``` bash
telnet 127.0.0.1 {port}
```
测试，会发现此时是可以连接的。这种异常需要在vncserver启动时加上
``` bash 
-localhost no
```
参数即可

### vnc viewer连接之后的显示问题

若使用上面提供的xstartup代码，连接之后会发现只有个终端，这个效果肯定不是我们希望的，甚至还不如直接ssh登录呢！所以，要搞出桌面。

- 安装桌面
``` bash
sudo apt-get install gnome-core xfce4
```
- 配置~/.vnc/xstartup文件

``` bash
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
startxfce4 &
[ -x /etc/vnc/xstartup ] && exec /etc/vnc/xstartup
[ -r $HOME/.Xresources ] && xrdb $HOME/.Xresources
xsetroot -solid grey
vncconfig -iconic &
```

- 重启vncserver，关闭vncsever命令 
``` bash
vncserver -kill :number
```
其中number表示桌面号，
``` bash
vncserver -localhost no
```
启动。

### vnc server启动失败问题

在执行一个vncserver关闭命令之后，可能下次启动会提示失败，查看日志，提示类似
``` bash
Fatal server error:
(EE) Cannot establish any listening sockets - Make sure an X server isn't already running(EE)
```
解决办法：
``` bash
rm -rf /tmp/.X11-unit/
```
接着
``` bash
ps -C Xorg
```
kill掉显示的进程即可。

## 其他

### vnc viewer连接的窗口大小、分辨率
在vnc server 启动时加上
``` bash
-geometry 1366x768
```
类似参数
