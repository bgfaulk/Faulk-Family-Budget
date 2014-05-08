package com.springapp.mvc.Services;

import com.springapp.mvc.Beans.LoginModel;

/**
 * LoginService Interface
 *
 * @author Brian Faulk
 */

public interface LoginService
{
    public boolean validate( LoginModel loginModel );
}
