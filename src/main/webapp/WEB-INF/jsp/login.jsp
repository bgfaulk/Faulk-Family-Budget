<%@    taglib uri="http://www.springframework.org/tags/form" prefix="form" %>
<!DOCTYPE html>
<html>
<head>
    <title>Sign In</title>
    <link rel="stylesheet" href="/resources/css/style.css" type="text/css" media="screen" title="no title"
          charset="utf-8">
</head>
<body>
<form:form id="form" action="login.do" method="post"
      commandName="loginDetails">
    <p>
        <label id="caption">Faulk Family Budget</label>
    </p>

    <p>
        <label for="username">Username</label>
        <input id="username" name="username" type="text">
    </p>

    <p>
        <label for="password">Password</label>
        <input id="password" name="password" type="password">
    </p>

    <p>
        <input type="submit" value="LOG IN" id="submit">
    </p>
</form:form>
<script src="http://code.jquery.com/jquery-1.11.0.min.js" type="text/javascript" charset="utf-8"></script>
<script src="/resources/js/app.js" type="text/javascript" charset="utf-8"></script>
</body>
</html>