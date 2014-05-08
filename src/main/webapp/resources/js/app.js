var $password = $("#password");
var $username = $("#username");

function redirect()
{
   if ($username === "bgfaulk" && $password === "newport1")
   {
      location.href = "/budget";
   }
}