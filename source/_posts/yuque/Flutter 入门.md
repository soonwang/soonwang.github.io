---
title: Flutter 入门
urlname: rvd599
date: '2022-09-09 17:38:42 +0000'
tags:
  - flutter
  - flutter 入门
categories: []
---

## 一、HelloWorld

演示

## 二、开发环境

```bash
export PUB_HOSTED_URL=https://pub.flutter-io.cn
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
```

<!-- more -->

## 三、基础组件

#### 1. Widget

![](https://image.soonwang.cn/blog/Fomlx3Hx0tt9qQIi36qgKTrDwmBJ.svg)
State 生命周期如下：
![](https://image.soonwang.cn/blog/FtVV1zQuBvDYLK54Uv_FUUjKReEn.png)

#### 2. Text、TextSpan、WidgetSpan

- Text 显示文字

```dart
Text(
	"Hello World",
  textAlign: TextAlign.left,
  maxLines: 1,
  overflow: TextOverflow.ellipise,
  style: TextStyle(
  	color: Colors.blue,
    fontSize: 10,
    ...
  )
)
```

- 实际开发过程中，还会有一个 Text 不同部分安装不同样式显示，可以用 TextSpan

```dart
Text.rich(
  TextSpan(
    children: [
      TextSpan(
        text: 'Title',
        style: TextStyle(
        	color: Color(0xff000000),
          fontWeight: bold,
        )
      ),
      TextSpan(
      	text: 'description',
        style: TextStyle(
          color: Colors.blue,
        )
      ),
      // WidgetSpan 可以实现行内元素的效果
      WidgetSpan(
      	child: Container(
        	...
        )
      )
    ]
	)
)
```

#### 3. Button、Image

- Button

Flutter 提供了几种样式的 Button，也支持自定义外观

```dart
RaisedButton(
  child: Text("normal"),
  onPressed: () {},
);
// 扁平按钮
FlatButton(
  child: Text("normal"),
  onPressed: () {},
)
// 默认有一个边框
OutlineButton(
  child: Text("normal"),
  onPressed: () {},
)
// icon 按钮
IconButton(
  icon: Icon(Icons.thumb_up),
  onPressed: () {},
)
```

- Image

Image 组件用来显示图片，数据源可以是 assets、文件、网络
Image 对加载过的图片会有缓存（内存），默认缓存数量是 1000，最大缓存空间是 100M

```dart
// 加载本地文件
Image(
	image: AssetImage('assets/images/3.0x/kaola.png'),
  width: 100,
)
// 快捷
Image.assets(
  'assets/images/3.0x/kaola.png',
  width: 100,
)

// 加载网络图片

Image(
	image: NetworkImage('$imageUrl'),
  width: 100.0
)
// 快捷
Image.network(
	'$imageUrl',
  width: 100.0,
)
```

#### 3. 表单、输入框、单选、复选

#### 4. 布局组件

- 线性布局：Row、Column
- 弹性布局：Flex、Expanded
- 流式布局：Wrap、Flow
- 层叠布局（绝对定位）：Stack、Position
- 对齐：Align

#### 5. 容器类组件

- Container 类似 div

```dart
// 其中 decoration constraints transform padding 都有对应的单独的Box类
Container(
  width: 100,
  height: 100,
  color: Colors.white, // 背景色
  padding: EdgeInsets.fromLTRB(20, 10, 20, 10),
  margin: EdgeInsets.fromLTRB(20, 10, 20, 10),
  // 背景装饰（圆角、背景色、boxShadow等）
	decoration: BoxDecoration(
    borderRadius: BorderRadius.all(Radius.circular(20)),
    color: Color(0xffffe030),
  ),
  // 大小限制
  constraints: BoxConstraints(
    maxWidth: 50,
    minWidth: 50
  ),
  // 变换
  transform: Matrix4.translationValues(20, 0, 0),
  child: Text(
    '$labelValue',
    style: TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w500,
      color: Colors.black,
    ),
  ),
)
```

#### 6. 可滚动组件

- ListView
- GridView
- SingleChildScrollView
- CustomScrollView

## 四、路由

#### 1. MaterialPageRoute

```dart
Navigator.push( context,
  MaterialPageRoute(
    builder: (context) {
      return NewRoute(); // page
    },
    // 包含路由信息，name，arguments
    settings: RouteSettings(
    	name: 'xx',
      arguments: {'xx': 'xxx'}
    ),
    maintainState: true, // 默认进入下个路由时，原来路由仍然会保存在内存中
    fullscreenDialog: false, // 是否是全屏对话框
  )
);
```

#### 2. Navigator

```dart
Navigator.push(BuildContext context, Route route);
Navigator.pop(BuildContext context, [result]);

var result = await Navigator.push(context, xxx);
Navigator.pop(context, '返回值xxx');
```

#### 3. 命名路由

```dart
MaterialApp(
  title: 'Flutter Demo',
  theme: ThemeData(
    primarySwatch: Colors.blue,
  ),
  //注册路由表
  routes:{
   "new_page":(context) => NewRoute(),
    ... // 省略其它路由注册信息
  } ,
  home: MyHomePage(title: 'Flutter Demo Home Page'),
);

// 打开命名路由
Navigator.pushNamed(context, 'new_page', arguments: 'xxxx');
```

#### 4. 命名路由 Hook

> 如果指定的路由名在路由表中已注册，则会调用路由表中的 builder 函数来生成路由组件；
> 如果路由表中没有注册，才会调用 onGenerateRoute 来生成路

```dart
MaterialApp(
  ... //省略无关代码
  onGenerateRoute:(RouteSettings settings){
      return MaterialPageRoute(builder: (context){
           String routeName = settings.name;
       // 如果访问的路由页需要登录，但当前未登录，则直接返回登录页路由，
       // 引导用户登录；其它情况则正常打开路由。
     }
   );
  }
);
```

## 五、网络请求

#### 1. Dio 库

```
dependencies:
  dio: 3.x #latest version
```

- 基础使用

```dart
// get 请求
Response res = await Dio().get('https://www.kaola.com', queryParameters: {
	"xx": "xx"
});
// post 请求
Response res = await Dio().post('https://wwww.kaola.com/api', data: {
	'xx': 'xx'
});
```

- BaseOptions

```dart
Dio dio = Dio(BaseOptions(
  baseUrl: 'https://mocks.alibaba-inc.com/mock/kaola-like',
  // ....
));
await  dio.get('/xx');

await dio.post('/xx');
```

#### 2. 处理 cookie

```yaml
# 依赖
dio_cookie_manager: ^1.0.0
cookie_jar: ^1.0.1
# 引入该依赖后，ios模拟器需要重新 build，可能需要进ios目录执行 pod install
path_provider: ^1.6.5
```

```dart
Dio dio = Dio(BaseOptions(
  baseUrl: 'https://mocks.alibaba-inc.com/mock/kaola-like',
  // ....
));
Directory appDocDir = await getApplicationDocumentsDirectory();
String appDocPath = appDocDir.path;
var cookieJar = PersistCookieJar(dir: '$appDocPath/.cookies/');

dio.interceptors.add(CookieManager(cookieJar));
```

#### 3. json 转 model

```dart
class User {
  final String name;
  final String email;

  User(this.name, this.email);

  User.fromJson(Map<String, dynamic> json)
      : name = json['name'],
        email = json['email'];

  Map<String, dynamic> toJson() =>
    <String, dynamic>{
      'name': name,
      'email': email,
    };
}
```

## 六、持久化存储

#### 1. SharedPreferences

```yaml
# 引入该依赖后，ios模拟器需要重新 build，可能需要进ios目录执行 pod install
shared_preferences: ^0.5.6
```

```dart
// key-value 存储
SharedPreferences _prefs = await SharedPreferences.getInstance();
// 存 key
awiat _prefs.setString(key, value);
// 读 key
String value = _prefs.getString(key);

```

#### 2. 文件操作

```dart
// path_provider
Directory appDocDir = await getApplicationDocumentsDirectory();
 String appDocPath = appDocDir.path;
File file = new File('$path/counter.txt');

// 读
String contents = await file.readAsString();
// 写
await file.writeAsString();
```

## 七、动画

- Animation: 主要用于保存动画插值和状态
  - addListener(): 帧监听器，每一帧都会被调用
  - addStatusListener(): 状态改变监听器，动画开始、结束、正向或反向 时会调用状态改变监听器
- Curve: 用来描述动画过程
- AnimationController: 用于控制动画，动画的启动 forward()、停止 stop()、反向播放 reverse()

```dart
final AnimationController controller = new AnimationController(
    duration: const Duration(milliseconds: 2000),
  	vsync: this
);
```

## 参考

- [Flutter 实战](https://book.flutterchina.club/intro.html)
- [Flutter 官网](https://flutter.dev)
- [Flutter 仓库](https://pub.dev/)
