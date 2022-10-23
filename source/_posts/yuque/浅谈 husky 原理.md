---
title: 浅谈 husky 原理
urlname: hgpg7a
date: '2022-10-23 14:47:16 +0000'
tags: []
categories: []
---

最近在搭建新工程时，想给工程配置 eslint 约定一下代码规范，配置完 eslint 之后，有想着可以更进一步配置一个强校验，即不符合 eslint 配置的代码，希望在代码提交时就拦截并给出提示。面对这个场景自然而然就想到了 `husky + lint-staged`的配置，说干就干。

- 首先是安装依赖，在工程根目录下执行以下命令：

```bash
npm i husky lint-staged -g
```

- 接着安装以往经验就是在 `package.json` 里配置相关配置：

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix --cache --quiet", "git add"]
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  }
}
```

执行完上面操作后，自信满满地修改了某个 tsx 文件，并故意违反某条 eslint 配置，一顿 git 命令执行完，发现居然 commit 成功了，这就意味着 husky 配置没生效，:(。
心里想着这不科学啊，然后在 github 上找到了 [husky 源码](https://github.com/typicode/husky)，原来 husky 升级了，break change ，surprise !
原来上面这套 husky 的配置是 v4 版本，而当前工程默认安装了最新版本的 husky ，已经是 v8 了。然后跟着文档，重新配置了一遍

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx --no eslint --fix --cache --quiet
git add
```

配置完成之后，再次测试，发现果然成功了。
事情本来到这里本来就该结束了，完结，撒花……

但是隐隐感觉到有哪里不对，按照我之前对 git hooks 以及 husky v4 的了解，git hooks 的作用是在于 工程里 hooks 的配置文件，这些 hook 文件会在 git 的特定时期执行，比如常见的 `pre-commit`、`commit-msg`等。
更多的可以查看[这里](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)。
而根据我之前的了解，以前版本的 husky 正是利用 git hooks 的机制，在安装依赖的时候执行 husky 里的脚本，修改了 git hooks 里的文件，具体目录为工程根目录下的 `.git/hooks/pre-commit`等。
那 husky v8 版本又是做了些什么呢，是什么原理呢，为什么在 `.husky/pre-commit`里配置就可以生效呢，是复制了一份到 `.git/hooks/`目录下吗？
好奇心的驱使下，进到 `.git/hooks/`目录下，一探究竟。结果惊了个呆，hooks 下面只有默认的一些 sample 文件，并没有期待中的 `pre-commit`文件复制版。

```bash
# cd .git/hooks
# ls
applypatch-msg.sample     pre-applypatch.sample     pre-rebase.sample
commit-msg.sample         pre-commit.sample         prepare-commit-msg.sample
post-update.sample        pre-push.sample           update.sample
```

那究竟是怎么回事呢，带着这样的疑问，去阅读了源码。还好，新版的 husky 代码少了许多，很容易就发现了其中的关键：

```javascript
// Configure repo
const { error } = git(["config", "core.hooksPath", dir]);
```

原来在执行 `husky install`的命令时，husky 会执行以下步骤：

1. 先执行一系列检查，确保是在 git 工程里，并存在 `.git`目录
2. 然后复制 `.husky`目录到工程根目录
3. 最后执行 `git config core.hooksPath .husky`，将 `.husky`目录配置为新的 git hooks 目录

这里 `git config core.hooksPath .husky`看字面意思就是重新设置 git hooks 的目录，默认的 git hooks 目录就像上面叙述的，是 `.git/hooks`，所以这个命令很明显就是替换这个目录，这样一切就解释的通了，豁然开朗的感觉！

![](https://image.soonwang.cn/blog/Fr-CqsIMj3UDOcNinzu-RqcqD-I5.png)
到现在可以说基本解答了疑惑，但是八卦的我还有一个疑问，既然有这么好用的一个 git 配置，为啥 husky 是另外的机制呢（直接修改 .git/hooks/ 目录下的 hook 文件）？
这个疑问最终在 StackOverflow 找到了答案：
[https://stackoverflow.com/questions/39332407/git-hooks-applying-git-config-core-hookspath](https://stackoverflow.com/questions/39332407/git-hooks-applying-git-config-core-hookspath)
![](https://image.soonwang.cn/blog/Fv7sFdVwwmTxG9s4TAgy1oIfyvDv.png)
原因就是`git config core.hooksPath`这个命令是在 Git v2.9.0 版本才支持的。
在 2016.05.05 提交的 commit 中支持了该命令[https://github.com/git/git/commit/867ad08a2610526edb5723804723d371136fc643](https://github.com/git/git/commit/867ad08a2610526edb5723804723d371136fc643)
那 husky 大概是什么时候创建的呢，通过查看 issues，我们可以发现第一个 issue 是在 2014 年，远比这个 commit 时期早！
[https://github.com/typicode/husky/issues/1](https://github.com/typicode/husky/issues/1)
![](https://image.soonwang.cn/blog/Fs4fhre-peuuEAyvbqPDyAcYhhlC.png)
真·完结·撒花！
