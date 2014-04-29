var $password = $("#password");
var $username = $("#username");

function changePage()
{
   changePage('/budget')
}

function changePage(url)
{
   window.location = url;
}